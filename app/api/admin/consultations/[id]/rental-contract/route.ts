import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  RENTAL_CONTRACT_SIGNATURE_BUCKET,
  RENTAL_CONTRACT_TERMS_VERSION,
  buildRentalContractDraft,
  createRentalContractAccessToken,
  createRentalContractNumber,
  hashRentalContractAccessToken,
  rentalContractDocumentHash,
  rentalTypeFromService,
  sanitizeRentalContractSnapshot,
  validateRentalContractForSending,
} from '@/lib/rentalContract';

export const dynamic='force-dynamic';

function unauthorized(error:unknown){
  return error instanceof Error&&error.message==='ADMIN_UNAUTHORIZED';
}

async function contractWithSignature(supabase:ReturnType<typeof getSupabaseServer>,contract:any){
  if(!contract)return null;
  let signature_url:string|null=null;
  if(contract.signature_path){
    const {data,error}=await supabase.storage
      .from(RENTAL_CONTRACT_SIGNATURE_BUCKET)
      .createSignedUrl(contract.signature_path,10*60);
    if(!error)signature_url=data.signedUrl;
  }
  return {...contract,signature_url};
}

async function getConsultation(supabase:ReturnType<typeof getSupabaseServer>,id:string){
  const {data,error}=await supabase.from('consultations').select('*').eq('id',id).single();
  if(error||!data)throw new Error('RENTAL_CONSULTATION_NOT_FOUND');
  if(!String(data.service_type||'').includes('렌탈'))throw new Error('NOT_RENTAL');
  return data;
}

async function nextVersion(supabase:ReturnType<typeof getSupabaseServer>,consultationId:string){
  const {data,error}=await supabase
    .from('rental_contracts')
    .select('version')
    .eq('consultation_id',consultationId)
    .order('version',{ascending:false})
    .limit(1);
  if(error)throw error;
  return Number(data?.[0]?.version||0)+1;
}

async function recordEvent(
  supabase:ReturnType<typeof getSupabaseServer>,
  contract:any,
  eventType:string,
  detail:Record<string,unknown>={}
){
  const {error}=await supabase.from('rental_contract_events').insert({
    contract_id:contract.id,
    consultation_id:contract.consultation_id,
    event_type:eventType,
    actor_type:'admin',
    detail,
  });
  if(error)console.error('rental contract event error',error);
}

export async function GET(
  _request:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const supabase=getSupabaseServer();
    await getConsultation(supabase,id);

    const {data,error}=await supabase
      .from('rental_contracts')
      .select('*')
      .eq('consultation_id',id)
      .order('version',{ascending:false});
    if(error)throw error;

    const contracts=data||[];
    return NextResponse.json({
      data:await contractWithSignature(supabase,contracts[0]||null),
      history:contracts.map((item:any)=>({
        id:item.id,
        version:item.version,
        contract_no:item.contract_no,
        contract_type:item.contract_type,
        status:item.status,
        sent_at:item.sent_at,
        signed_at:item.signed_at,
        superseded_at:item.superseded_at,
        voided_at:item.voided_at,
        document_sha256:item.document_sha256,
      })),
    });
  }catch(error){
    if(unauthorized(error))return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    const message=error instanceof Error?error.message:'';
    if(message==='RENTAL_CONSULTATION_NOT_FOUND')return NextResponse.json({error:'렌탈 상담을 찾을 수 없습니다.'},{status:404});
    if(message==='NOT_RENTAL')return NextResponse.json({error:'렌탈 상담에만 계약서를 만들 수 있습니다.'},{status:400});
    console.error('rental contract get error',error);
    return NextResponse.json({error:message||'렌탈 계약서 조회 오류'},{status:500});
  }
}

export async function POST(
  request:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const body=await request.json().catch(()=>({}));
    const action=String(body.action||'create');
    const supabase=getSupabaseServer();
    const consultation=await getConsultation(supabase,id);

    const {data:openContract,error:openError}=await supabase
      .from('rental_contracts')
      .select('*')
      .eq('consultation_id',id)
      .in('status',['draft','sent'])
      .maybeSingle();
    if(openError)throw openError;
    if(openContract){
      return NextResponse.json({
        error:openContract.status==='sent'
          ?'고객 서명을 기다리는 계약서가 이미 있습니다.'
          :'작성 중인 계약서가 이미 있습니다.',
        data:await contractWithSignature(supabase,openContract),
      },{status:409});
    }

    const version=await nextVersion(supabase,id);
    const contractType=rentalTypeFromService(consultation.service_type);
    let sourceSnapshot:any=null;

    if(action==='revision'){
      const sourceId=String(body.source_contract_id||'');
      const {data:source,error:sourceError}=await supabase
        .from('rental_contracts')
        .select('*')
        .eq('id',sourceId)
        .eq('consultation_id',id)
        .in('status',['signed','superseded'])
        .single();
      if(sourceError||!source)return NextResponse.json({error:'변경할 서명 계약서를 찾을 수 없습니다.'},{status:404});
      sourceSnapshot=source.document_snapshot;
    }

    let providerDefaults:any=null;
    if(!sourceSnapshot){
      const {data:previous}=await supabase
        .from('rental_contracts')
        .select('document_snapshot')
        .order('created_at',{ascending:false})
        .limit(1);
      providerDefaults=previous?.[0]?.document_snapshot?.provider||null;
    }

    const contractNo=createRentalContractNumber(id,version);
    const snapshot=sourceSnapshot
      ?sanitizeRentalContractSnapshot(sourceSnapshot,contractNo,contractType)
      :buildRentalContractDraft({consultation,contractNo,contractType,providerDefaults});
    const documentHash=rentalContractDocumentHash(snapshot);

    const {data:contract,error}=await supabase
      .from('rental_contracts')
      .insert({
        consultation_id:id,
        version,
        contract_no:contractNo,
        contract_type:contractType,
        status:'draft',
        document_snapshot:snapshot,
        document_sha256:documentHash,
        terms_version:RENTAL_CONTRACT_TERMS_VERSION,
      })
      .select('*')
      .single();
    if(error)throw error;

    await recordEvent(supabase,contract,action==='revision'?'revision_created':'draft_created',{version});
    return NextResponse.json({data:contract},{status:201});
  }catch(error){
    if(unauthorized(error))return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    const message=error instanceof Error?error.message:'';
    if(message==='RENTAL_CONSULTATION_NOT_FOUND')return NextResponse.json({error:'렌탈 상담을 찾을 수 없습니다.'},{status:404});
    if(message==='NOT_RENTAL')return NextResponse.json({error:'렌탈 상담에만 계약서를 만들 수 있습니다.'},{status:400});
    console.error('rental contract create error',error);
    return NextResponse.json({error:message||'렌탈 계약서 생성 오류'},{status:500});
  }
}

export async function PATCH(
  request:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const body=await request.json();
    const action=String(body.action||'save');
    const contractId=String(body.contract_id||'');
    const supabase=getSupabaseServer();
    await getConsultation(supabase,id);

    const {data:contract,error:contractError}=await supabase
      .from('rental_contracts')
      .select('*')
      .eq('id',contractId)
      .eq('consultation_id',id)
      .single();
    if(contractError||!contract)return NextResponse.json({error:'계약서를 찾을 수 없습니다.'},{status:404});

    if(action==='save'){
      if(contract.status!=='draft')return NextResponse.json({error:'고객에게 발송했거나 서명된 계약서는 수정할 수 없습니다.'},{status:409});
      const snapshot=sanitizeRentalContractSnapshot(
        body.snapshot,
        contract.contract_no,
        contract.contract_type
      );
      const documentHash=rentalContractDocumentHash(snapshot);
      const {data:updated,error}=await supabase
        .from('rental_contracts')
        .update({document_snapshot:snapshot,document_sha256:documentHash,updated_at:new Date().toISOString()})
        .eq('id',contract.id)
        .eq('status','draft')
        .select('*')
        .single();
      if(error)throw error;
      await recordEvent(supabase,updated,'draft_saved',{document_sha256:documentHash});
      return NextResponse.json({data:updated});
    }

    if(action==='send'){
      if(contract.status!=='draft')return NextResponse.json({error:'작성 중인 계약서만 고객에게 발송할 수 있습니다.'},{status:409});
      const missing=validateRentalContractForSending(contract.document_snapshot);
      if(missing.length)return NextResponse.json({error:`계약서 필수정보를 확인해 주세요: ${missing.join(', ')}`},{status:400});

      const rawToken=createRentalContractAccessToken();
      const tokenHash=hashRentalContractAccessToken(rawToken);
      const now=new Date();
      const expires=new Date(now.getTime()+14*24*60*60*1000);
      const {data:updated,error}=await supabase
        .from('rental_contracts')
        .update({
          status:'sent',
          access_token_hash:tokenHash,
          access_expires_at:expires.toISOString(),
          phone_verification_failures:0,
          phone_locked_until:null,
          phone_verified_at:null,
          sent_at:now.toISOString(),
          updated_at:now.toISOString(),
        })
        .eq('id',contract.id)
        .eq('status','draft')
        .select('*')
        .single();
      if(error)throw error;

      const {error:consultationError}=await supabase.from('consultations').update({
        rental_stage:'계약대기',
        rental_stage_updated_at:now.toISOString(),
        status:'견적발송',
        updated_at:now.toISOString(),
      }).eq('id',id);
      if(consultationError)throw consultationError;

      await recordEvent(supabase,updated,'sent',{expires_at:expires.toISOString()});
      return NextResponse.json({
        data:updated,
        share_url:`${request.nextUrl.origin}/rental-contract/${rawToken}`,
      });
    }

    if(action==='share'){
      if(!['sent','signed','superseded'].includes(contract.status)){
        return NextResponse.json({error:'발송 또는 서명된 계약서만 열람 링크를 만들 수 있습니다.'},{status:409});
      }
      const rawToken=createRentalContractAccessToken();
      const tokenHash=hashRentalContractAccessToken(rawToken);
      const expires=new Date(Date.now()+(contract.status==='sent'?14:30)*24*60*60*1000);
      const {data:updated,error}=await supabase.from('rental_contracts').update({
        access_token_hash:tokenHash,
        access_expires_at:expires.toISOString(),
        phone_verification_failures:0,
        phone_locked_until:null,
        phone_verified_at:null,
        updated_at:new Date().toISOString(),
      }).eq('id',contract.id).select('*').single();
      if(error)throw error;
      await recordEvent(supabase,updated,'access_link_reissued',{expires_at:expires.toISOString()});
      return NextResponse.json({
        data:updated,
        share_url:`${request.nextUrl.origin}/rental-contract/${rawToken}`,
      });
    }

    if(action==='void'){
      if(!['draft','sent'].includes(contract.status)){
        return NextResponse.json({error:'작성 중이거나 서명 대기 중인 계약서만 취소할 수 있습니다.'},{status:409});
      }
      const reason=String(body.reason||'관리자 취소').trim().slice(0,1000);
      const now=new Date().toISOString();
      const {data:updated,error}=await supabase.from('rental_contracts').update({
        status:'void',
        access_token_hash:null,
        access_expires_at:null,
        voided_at:now,
        void_reason:reason,
        updated_at:now,
      }).eq('id',contract.id).in('status',['draft','sent']).select('*').single();
      if(error)throw error;
      await recordEvent(supabase,updated,'voided',{reason});
      return NextResponse.json({data:updated});
    }

    return NextResponse.json({error:'허용되지 않은 계약서 작업입니다.'},{status:400});
  }catch(error){
    if(unauthorized(error))return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    console.error('rental contract update error',error);
    return NextResponse.json({error:error instanceof Error?error.message:'렌탈 계약서 저장 오류'},{status:500});
  }
}
