import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  createRentalAssetNumber,
  recordRentalAssetEvent,
  sanitizeRentalAssetInput,
  syncRentalProductFromAssets,
} from '@/lib/rentalAsset';

export const dynamic='force-dynamic';

function unauthorized(error:unknown){
  return error instanceof Error&&(
    error.message==='ADMIN_UNAUTHORIZED'||error.message==='UNAUTHORIZED'
  );
}

async function rentalProducts(supabase:ReturnType<typeof getSupabaseServer>){
  const {data,error}=await supabase
    .from('products')
    .select(`
      id,title,name,brand,model_name,model,rental_type,status,stock_qty,
      rental_asset_managed,is_visible,updated_at
    `)
    .eq('listing_type','rental')
    .order('updated_at',{ascending:false});
  if(error)throw error;
  return data||[];
}

export async function GET(req:NextRequest){
  try{
    await requireAdmin();
    const supabase=getSupabaseServer();
    const status=String(req.nextUrl.searchParams.get('status')||'').trim();
    const productId=String(req.nextUrl.searchParams.get('product_id')||'').trim();
    const keyword=String(req.nextUrl.searchParams.get('q')||'').trim();

    let query=supabase
      .from('rental_assets')
      .select('*')
      .order('updated_at',{ascending:false})
      .limit(1000);
    if(status&&status!=='전체')query=query.eq('status',status);
    if(productId)query=query.eq('product_id',productId);
    if(keyword){
      const safe=keyword.replace(/[%_,]/g,' ');
      query=query.or(
        `asset_no.ilike.%${safe}%,serial_number.ilike.%${safe}%,title.ilike.%${safe}%,brand.ilike.%${safe}%,model_name.ilike.%${safe}%,location_text.ilike.%${safe}%`
      );
    }

    const [{data:assets,error:assetError},products]=await Promise.all([
      query,
      rentalProducts(supabase),
    ]);
    if(assetError)throw assetError;

    const consultationIds=(assets||[])
      .map((item:any)=>item.current_consultation_id)
      .filter(Boolean);
    let consultations:any[]=[];
    if(consultationIds.length){
      const {data,error}=await supabase
        .from('consultations')
        .select('id,customer_name,name,phone,address,rental_contract_no,rental_stage')
        .in('id',consultationIds);
      if(error)throw error;
      consultations=data||[];
    }

    const rows=(assets||[]).map((asset:any)=>({
      ...asset,
      customer:consultations.find(item=>item.id===asset.current_consultation_id)||null,
    }));
    const productRows=products.map((product:any)=>{
      const own=(assets||[]).filter((asset:any)=>asset.product_id===product.id);
      return {
        ...product,
        asset_count:own.length,
        available_count:own.filter((asset:any)=>asset.status==='렌탈가능').length,
        active_count:own.filter((asset:any)=>
          ['배정완료','설치예약','렌탈중','회수예정'].includes(asset.status)
        ).length,
      };
    });

    const allAssets=assets||[];
    const summary={
      total:allAssets.length,
      available:allAssets.filter((item:any)=>item.status==='렌탈가능').length,
      assigned:allAssets.filter((item:any)=>item.status==='배정완료').length,
      installation:allAssets.filter((item:any)=>item.status==='설치예약').length,
      operating:allAssets.filter((item:any)=>item.status==='렌탈중').length,
      retrieval:allAssets.filter((item:any)=>item.status==='회수예정').length,
      maintenance:allAssets.filter((item:any)=>['점검중','정비중'].includes(item.status)).length,
    };

    return NextResponse.json({data:rows,products:productRows,summary});
  }catch(error:unknown){
    if(unauthorized(error)){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('rental assets load error',error);
    return NextResponse.json({
      error:error instanceof Error?error.message:'렌탈 자산대장 조회 오류',
    },{status:500});
  }
}

export async function POST(req:NextRequest){
  try{
    await requireAdmin();
    const body=await req.json();
    const action=String(body.action||'create');
    const supabase=getSupabaseServer();

    if(action==='activate_product'){
      const productId=String(body.product_id||'').trim();
      if(!productId){
        return NextResponse.json({error:'렌탈 상품을 선택해 주세요.'},{status:400});
      }
      const {count,error:countError}=await supabase
        .from('rental_assets')
        .select('id',{count:'exact',head:true})
        .eq('product_id',productId);
      if(countError)throw countError;
      if(!count){
        return NextResponse.json({
          error:'먼저 이 상품의 실물 안마의자를 자산대장에 모두 등록해 주세요.',
        },{status:409});
      }
      const {count:unlinkedCount,error:unlinkedError}=await supabase
        .from('consultations')
        .select('id',{count:'exact',head:true})
        .eq('product_id',productId)
        .in('rental_stage',['설치예약','운영중'])
        .is('rental_asset_id',null);
      if(unlinkedError)throw unlinkedError;
      if(unlinkedCount){
        return NextResponse.json({
          error:`설치예약·운영중 계약 ${unlinkedCount}건에 실물 자산이 아직 연결되지 않았습니다. 각 계약에서 자산을 먼저 배정해 주세요.`,
        },{status:409});
      }
      const {error}=await supabase.from('products').update({
        rental_asset_managed:true,
        updated_at:new Date().toISOString(),
      }).eq('id',productId).eq('listing_type','rental');
      if(error)throw error;
      await syncRentalProductFromAssets(supabase,productId);
      return NextResponse.json({success:true,asset_count:count});
    }

    const input=sanitizeRentalAssetInput(body);
    if(!input.product_id){
      return NextResponse.json({error:'렌탈 상품을 선택해 주세요.'},{status:400});
    }
    const {data:product,error:productError}=await supabase
      .from('products')
      .select('id,title,name,brand,model_name,model,rental_type,listing_type')
      .eq('id',input.product_id)
      .maybeSingle();
    if(productError)throw productError;
    if(!product||product.listing_type!=='rental'){
      return NextResponse.json({error:'렌탈 상품을 찾을 수 없습니다.'},{status:404});
    }

    const payload={
      ...input,
      asset_no:input.asset_no||createRentalAssetNumber(),
      title:product.title||product.name||'렌탈 안마의자',
      brand:product.brand||null,
      model_name:product.model_name||product.model||null,
      rental_type:product.rental_type||null,
    };
    const {data,error}=await supabase
      .from('rental_assets')
      .insert(payload)
      .select('*')
      .single();
    if(error)throw error;

    await recordRentalAssetEvent({
      supabase,
      assetId:data.id,
      eventType:'registered',
      toStatus:data.status,
      actorType:'admin',
      detail:{asset_no:data.asset_no,serial_number:data.serial_number},
    });
    await syncRentalProductFromAssets(supabase,data.product_id);
    return NextResponse.json({data},{status:201});
  }catch(error:unknown){
    if(unauthorized(error)){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    const message=error instanceof Error?error.message:'렌탈 자산 등록 오류';
    if(message.includes('duplicate key')){
      return NextResponse.json({error:'이미 등록된 자산번호 또는 제조번호입니다.'},{status:409});
    }
    console.error('rental asset create error',error);
    return NextResponse.json({error:message},{status:500});
  }
}
