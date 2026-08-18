import crypto from 'node:crypto';
import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  RENTAL_CONTRACT_COOKIE,
  RENTAL_CONTRACT_SIGNATURE_BUCKET,
  createRentalContractSession,
  hashRentalContractAccessToken,
  maskPhone,
  normalizePhone,
  rentalContractCookieOptions,
  verifyRentalContractSession,
} from '@/lib/rentalContract';

export const dynamic='force-dynamic';

function noStore(response:NextResponse){
  response.headers.set('Cache-Control','no-store, max-age=0');
  response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  return response;
}

function safePhoneEqual(a:unknown,b:unknown){
  const left=Buffer.from(normalizePhone(a));
  const right=Buffer.from(normalizePhone(b));
  return left.length===right.length&&left.length>=9&&crypto.timingSafeEqual(left,right);
}

async function findContract(token:string){
  const tokenHash=hashRentalContractAccessToken(token);
  const supabase=getSupabaseServer();
  const {data,error}=await supabase
    .from('rental_contracts')
    .select('*')
    .eq('access_token_hash',tokenHash)
    .in('status',['sent','signed','superseded'])
    .maybeSingle();
  if(error)throw error;
  return {supabase,contract:data,tokenHash};
}

function expired(contract:any){
  return Boolean(
    contract?.access_expires_at&&
    new Date(contract.access_expires_at).getTime()<Date.now()
  );
}

export async function GET(
  _request:NextRequest,
  {params}:{params:Promise<{token:string}>}
){
  try{
    const {token}=await params;
    const {supabase,contract,tokenHash}=await findContract(token);
    if(!contract)return noStore(NextResponse.json({error:'계약서 링크가 올바르지 않습니다.'},{status:404}));
    if(expired(contract))return noStore(NextResponse.json({error:'계약서 열람 링크의 유효기간이 끝났습니다. 담당자에게 새 링크를 요청해 주세요.'},{status:410}));

    const cookieStore=await cookies();
    const verified=verifyRentalContractSession(
      cookieStore.get(RENTAL_CONTRACT_COOKIE)?.value,
      contract.id,
      tokenHash
    );

    if(!verified){
      return noStore(NextResponse.json({
        error:'계약서 열람을 위해 연락처 확인이 필요합니다.',
        verification_required:true,
        masked_phone:maskPhone(contract.document_snapshot?.customer?.phone),
        status:contract.status,
      },{status:401}));
    }

    let signatureUrl:string|null=null;
    if(contract.signature_path){
      const {data}=await supabase.storage
        .from(RENTAL_CONTRACT_SIGNATURE_BUCKET)
        .createSignedUrl(contract.signature_path,10*60);
      signatureUrl=data?.signedUrl||null;
    }

    return noStore(NextResponse.json({data:{
      id:contract.id,
      version:contract.version,
      contract_no:contract.contract_no,
      contract_type:contract.contract_type,
      customer_entity_type:contract.customer_entity_type,
      status:contract.status,
      document_snapshot:contract.document_snapshot,
      document_sha256:contract.document_sha256,
      terms_version:contract.terms_version,
      sent_at:contract.sent_at,
      signed_at:contract.signed_at,
      signer_name:contract.signer_name,
      signature_url:signatureUrl,
    }}));
  }catch(error){
    console.error('public rental contract get error',error);
    return noStore(NextResponse.json({error:'계약서를 불러오지 못했습니다.'},{status:500}));
  }
}

export async function POST(
  request:NextRequest,
  {params}:{params:Promise<{token:string}>}
){
  try{
    const {token}=await params;
    const body=await request.json();
    const {supabase,contract,tokenHash}=await findContract(token);
    if(!contract)return noStore(NextResponse.json({error:'계약서 링크가 올바르지 않습니다.'},{status:404}));
    if(expired(contract))return noStore(NextResponse.json({error:'계약서 링크의 유효기간이 끝났습니다.'},{status:410}));

    if(contract.phone_locked_until&&new Date(contract.phone_locked_until).getTime()>Date.now()){
      return noStore(NextResponse.json({error:'연락처 확인이 여러 번 실패했습니다. 15분 후 다시 시도해 주세요.'},{status:429}));
    }

    if(!safePhoneEqual(body.phone,contract.document_snapshot?.customer?.phone)){
      const failures=Number(contract.phone_verification_failures||0)+1;
      const lockedUntil=failures>=5?new Date(Date.now()+15*60*1000).toISOString():null;
      await supabase.from('rental_contracts').update({
        phone_verification_failures:failures>=5?0:failures,
        phone_locked_until:lockedUntil,
        updated_at:new Date().toISOString(),
      }).eq('id',contract.id);
      return noStore(NextResponse.json({
        error:lockedUntil
          ?'연락처 확인이 여러 번 실패했습니다. 15분 후 다시 시도해 주세요.'
          :'계약서에 등록된 연락처와 일치하지 않습니다.',
      },{status:lockedUntil?429:401}));
    }

    const now=new Date().toISOString();
    const {error:updateError}=await supabase.from('rental_contracts').update({
      phone_verification_failures:0,
      phone_locked_until:null,
      phone_verified_at:now,
      updated_at:now,
    }).eq('id',contract.id);
    if(updateError)throw updateError;

    await supabase.from('rental_contract_events').insert({
      contract_id:contract.id,
      consultation_id:contract.consultation_id,
      event_type:'phone_verified',
      actor_type:'customer',
      detail:{},
    });

    const response=noStore(NextResponse.json({success:true}));
    response.cookies.set(
      RENTAL_CONTRACT_COOKIE,
      createRentalContractSession(contract.id,tokenHash),
      rentalContractCookieOptions
    );
    return response;
  }catch(error){
    console.error('rental contract phone verify error',error);
    return noStore(NextResponse.json({error:'연락처를 확인하지 못했습니다.'},{status:500}));
  }
}
