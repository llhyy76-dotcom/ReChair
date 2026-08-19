import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {syncRentalProductFromAssets} from '@/lib/rentalAsset';

export const dynamic='force-dynamic';

function unauthorized(error:unknown){
  return error instanceof Error&&(
    error.message==='ADMIN_UNAUTHORIZED'||error.message==='UNAUTHORIZED'
  );
}

async function loadData(supabase:ReturnType<typeof getSupabaseServer>,id:string){
  const {data:consultation,error}=await supabase
    .from('consultations')
    .select(`
      id,service_type,product_id,product_title,rental_stage,
      rental_contract_id,rental_contract_signed_at,rental_asset_id
    `)
    .eq('id',id)
    .single();
  if(error||!consultation)throw new Error('RENTAL_CONSULTATION_NOT_FOUND');
  if(!String(consultation.service_type||'').includes('렌탈'))throw new Error('NOT_RENTAL_CONSULTATION');

  let product:any=null;
  let assigned:any=null;
  let available:any[]=[];
  if(consultation.product_id){
    const [{data:productData,error:productError},{data:availableData,error:availableError}]=await Promise.all([
      supabase.from('products')
        .select('id,title,name,brand,model_name,model,rental_asset_managed')
        .eq('id',consultation.product_id).maybeSingle(),
      supabase.from('rental_assets').select('*')
        .eq('product_id',consultation.product_id)
        .eq('status','렌탈가능')
        .is('current_consultation_id',null)
        .order('asset_no',{ascending:true}),
    ]);
    if(productError)throw productError;
    if(availableError)throw availableError;
    product=productData||null;
    available=availableData||[];
  }
  if(consultation.rental_asset_id){
    const {data,error:assetError}=await supabase
      .from('rental_assets').select('*')
      .eq('id',consultation.rental_asset_id).maybeSingle();
    if(assetError)throw assetError;
    assigned=data||null;
  }
  return {consultation,product,assigned,available};
}

export async function GET(
  _req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    return NextResponse.json({data:await loadData(getSupabaseServer(),id)});
  }catch(error:unknown){
    if(unauthorized(error))return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    const message=error instanceof Error?error.message:'';
    if(message==='RENTAL_CONSULTATION_NOT_FOUND')return NextResponse.json({error:'렌탈 상담을 찾을 수 없습니다.'},{status:404});
    if(message==='NOT_RENTAL_CONSULTATION')return NextResponse.json({error:'렌탈 상담에만 자산을 배정할 수 있습니다.'},{status:400});
    return NextResponse.json({error:message||'렌탈 자산 배정정보 조회 오류'},{status:500});
  }
}

export async function PATCH(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const body=await req.json();
    const action=String(body.action||'assign');
    const supabase=getSupabaseServer();
    const before=await loadData(supabase,id);
    if(action==='release'){
      const {error}=await supabase.rpc('release_rental_asset',{p_consultation_id:id});
      if(error)throw error;
      await syncRentalProductFromAssets(supabase,before.consultation.product_id);
      return NextResponse.json({data:await loadData(supabase,id)});
    }

    const assetId=String(body.asset_id||'').trim();
    if(!assetId)return NextResponse.json({error:'배정할 자산을 선택해 주세요.'},{status:400});
    const {error}=await supabase.rpc('assign_rental_asset',{
      p_consultation_id:id,
      p_asset_id:assetId,
    });
    if(error)throw error;
    await syncRentalProductFromAssets(supabase,before.consultation.product_id);
    return NextResponse.json({data:await loadData(supabase,id)});
  }catch(error:unknown){
    if(unauthorized(error))return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    const raw=error instanceof Error?error.message:String(error||'');
    const messages:Record<string,string>={
      RENTAL_CONSULTATION_NOT_FOUND:'렌탈 상담을 찾을 수 없습니다.',
      NOT_RENTAL_CONSULTATION:'렌탈 상담에만 자산을 배정할 수 있습니다.',
      SIGNED_RENTAL_CONTRACT_REQUIRED:'고객 전자서명이 완료된 계약서가 있어야 자산을 배정할 수 있습니다.',
      RENTAL_ASSET_ASSIGNMENT_STAGE:'렌탈 단계가 계약완료·설치예약·운영중일 때 자산을 배정할 수 있습니다.',
      PREVIOUS_RENTAL_ASSET_LOCKED:'기존 자산의 설치·운영이 시작되어 교체할 수 없습니다.',
      RENTAL_ASSET_NOT_FOUND:'렌탈 자산을 찾을 수 없습니다.',
      RENTAL_ASSET_NOT_AVAILABLE:'선택한 자산은 이미 배정되었거나 렌탈 가능한 상태가 아닙니다.',
      RENTAL_ASSET_PRODUCT_MISMATCH:'상담 상품과 선택한 자산의 상품이 다릅니다.',
      RENTAL_ASSET_ASSIGNMENT_NOT_FOUND:'이 계약에 배정된 자산이 없습니다.',
      RENTAL_ASSET_RELEASE_LOCKED:'설치·운영이 시작된 자산은 배정을 해제할 수 없습니다.',
      RENTAL_INSTALLATION_ALREADY_CREATED:'설치 일정이 생성된 뒤에는 자산 배정을 해제할 수 없습니다.',
    };
    const code=Object.keys(messages).find(key=>raw.includes(key));
    console.error('rental asset assignment error',error);
    return NextResponse.json({error:code?messages[code]:raw||'렌탈 자산 배정 오류'},{status:409});
  }
}
