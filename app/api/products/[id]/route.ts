import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const {data,error}=await getSupabaseServer().from('products').select('*').eq('id',id).single();
    if(error)throw error;
    return NextResponse.json({data});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'상품 조회 오류'},{status:500});
  }
}

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const b=await request.json();
    const title=String(b.title||'').trim();
    const brand=String(b.brand||'').trim();
    const modelName=String(b.model_name||'').trim();
    if(!brand||!modelName||!title)return NextResponse.json({error:'브랜드, 모델명, 상품명은 필수입니다.'},{status:400});
    const photos=Array.isArray(b.photo_urls)?b.photo_urls.filter(Boolean):[];
    const thumbnail=String(b.thumbnail_url||photos[0]||'').trim()||null;
    const listingType=b.listing_type==='rental'?'rental':'sale';
    const rentalType=listingType==='rental'&&b.rental_type==='commercial'?'commercial':listingType==='rental'?'personal':null;
    const payload={
      title,brand,model_name:modelName,price:Number(b.price||0),grade:String(b.grade||'A급'),
      status:String(b.status||'판매중'),year_text:String(b.year_text||'').trim()||null,
      region:String(b.region||'').trim()||null,description:String(b.description||'').trim()||null,
      warranty_text:String(b.warranty_text||'').trim()||null,thumbnail_url:thumbnail,photo_urls:photos,
      stock_qty:Math.max(0,Number(b.stock_qty??1)),is_visible:b.is_visible!==false,is_featured:b.is_featured===true,
      listing_type:listingType,rental_type:rentalType,
      monthly_fee:Math.max(0,Number(b.monthly_fee||0)),deposit_amount:Math.max(0,Number(b.deposit_amount||0)),
      setup_fee:Math.max(0,Number(b.setup_fee||0)),contract_months:Math.max(0,Math.trunc(Number(b.contract_months||0))),
      installation_regions:String(b.installation_regions||'').trim()||null,
      rental_notes:String(b.rental_notes||'').trim()||null,
      updated_at:new Date().toISOString(),name:title,model:modelName,image_url:thumbnail,
    };
    const {data,error}=await getSupabaseServer().from('products').update(payload).eq('id',id).select().single();
    if(error)throw error;
    return NextResponse.json({data});
  }catch(error){
    const message=error instanceof Error?error.message:'상품 수정 오류';
    console.error('product PATCH error',error);
    return NextResponse.json({error:message},{status:500});
  }
}

export async function DELETE(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const {error}=await getSupabaseServer().from('products').delete().eq('id',id);
    if(error)throw error;
    return NextResponse.json({success:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'상품 삭제 오류'},{status:500});
  }
}
