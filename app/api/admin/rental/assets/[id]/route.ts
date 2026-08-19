import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  recordRentalAssetEvent,
  sanitizeRentalAssetInput,
  syncRentalProductFromAssets,
} from '@/lib/rentalAsset';

export const dynamic='force-dynamic';

const ACTIVE_STATUSES=['배정완료','설치예약','렌탈중','회수예정'];

function unauthorized(error:unknown){
  return error instanceof Error&&(
    error.message==='ADMIN_UNAUTHORIZED'||error.message==='UNAUTHORIZED'
  );
}

export async function GET(
  _req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const supabase=getSupabaseServer();
    const [{data,error},{data:events,error:eventError}]=await Promise.all([
      supabase.from('rental_assets').select('*').eq('id',id).single(),
      supabase.from('rental_asset_events').select('*')
        .eq('asset_id',id).order('created_at',{ascending:false}).limit(100),
    ]);
    if(error||!data)return NextResponse.json({error:'렌탈 자산을 찾을 수 없습니다.'},{status:404});
    if(eventError)throw eventError;
    return NextResponse.json({data,events:events||[]});
  }catch(error:unknown){
    if(unauthorized(error))return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    return NextResponse.json({error:error instanceof Error?error.message:'렌탈 자산 조회 오류'},{status:500});
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
    const supabase=getSupabaseServer();
    const {data:current,error:loadError}=await supabase
      .from('rental_assets').select('*').eq('id',id).single();
    if(loadError||!current){
      return NextResponse.json({error:'렌탈 자산을 찾을 수 없습니다.'},{status:404});
    }
    if(ACTIVE_STATUSES.includes(String(current.status))){
      return NextResponse.json({
        error:'계약에 연결된 자산의 상태와 상품은 설치·회수 절차에서만 변경할 수 있습니다.',
      },{status:409});
    }

    const input=sanitizeRentalAssetInput(body);
    const productId=input.product_id||current.product_id;
    const {data:product,error:productError}=await supabase
      .from('products')
      .select('id,title,name,brand,model_name,model,rental_type,listing_type')
      .eq('id',productId)
      .maybeSingle();
    if(productError)throw productError;
    if(!product||product.listing_type!=='rental'){
      return NextResponse.json({error:'렌탈 상품을 찾을 수 없습니다.'},{status:404});
    }

    const payload={
      ...input,
      product_id:product.id,
      asset_no:input.asset_no||current.asset_no,
      title:product.title||product.name||current.title,
      brand:product.brand||null,
      model_name:product.model_name||product.model||null,
      rental_type:product.rental_type||null,
      updated_at:new Date().toISOString(),
    };
    const {data,error}=await supabase
      .from('rental_assets')
      .update(payload)
      .eq('id',id)
      .select('*')
      .single();
    if(error)throw error;

    if(String(current.status)!==String(data.status)){
      await recordRentalAssetEvent({
        supabase,
        assetId:id,
        eventType:'manual_status_changed',
        fromStatus:current.status,
        toStatus:data.status,
        actorType:'admin',
        detail:{memo:data.memo},
      });
    }
    await Promise.all([
      syncRentalProductFromAssets(supabase,current.product_id),
      current.product_id===data.product_id
        ?Promise.resolve(false)
        :syncRentalProductFromAssets(supabase,data.product_id),
    ]);
    return NextResponse.json({data});
  }catch(error:unknown){
    if(unauthorized(error))return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    const message=error instanceof Error?error.message:'렌탈 자산 저장 오류';
    if(message.includes('duplicate key')){
      return NextResponse.json({error:'이미 등록된 자산번호 또는 제조번호입니다.'},{status:409});
    }
    console.error('rental asset update error',error);
    return NextResponse.json({error:message},{status:500});
  }
}
