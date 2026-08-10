import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(request:NextRequest){
  try{
    const supabase=getSupabaseServer();
    let query=supabase.from('products').select('*').order('is_featured',{ascending:false}).order('created_at',{ascending:false});
    if(request.nextUrl.searchParams.get('visible')==='true')query=query.eq('is_visible',true);
    const listingType=request.nextUrl.searchParams.get('listing_type');
    const rentalType=request.nextUrl.searchParams.get('rental_type');
    if(listingType==='sale'||listingType==='rental')query=query.eq('listing_type',listingType);
    if(rentalType==='personal'||rentalType==='commercial')query=query.eq('rental_type',rentalType);
    const {data,error}=await query;
    if(error)throw error;
    const normalized=(data||[]).map((product:any)=>({
      ...product,
      title:product.title||product.name||[product.brand,product.model_name||product.model].filter(Boolean).join(' ')||'안마의자',
      name:product.name||product.title||null,
      model_name:product.model_name||product.model||null,
      model:product.model||product.model_name||null,
      thumbnail_url:product.thumbnail_url||product.image_url||null,
      image_url:product.image_url||product.thumbnail_url||null,
    }));
    return NextResponse.json({data:normalized});
  }catch(error){
    const message=error instanceof Error?error.message:'상품 조회 오류';
    console.error('products GET error',error);
    return NextResponse.json({error:message},{status:500});
  }
}

export async function POST(request:NextRequest){
  try{
    await requireAdmin();
    const b=await request.json();
    const supabase=getSupabaseServer();
    const title=String(b.title||'').trim();
    const brand=String(b.brand||'').trim();
    const modelName=String(b.model_name||'').trim();
    if(!brand||!modelName||!title){
      return NextResponse.json({error:'브랜드, 모델명, 상품명은 필수입니다.'},{status:400});
    }
    const photos=Array.isArray(b.photo_urls)?b.photo_urls.filter(Boolean):[];
    const thumbnail=String(b.thumbnail_url||photos[0]||'').trim()||null;
    const listingType=b.listing_type==='rental'?'rental':'sale';
    const rentalType=listingType==='rental'&&b.rental_type==='commercial'?'commercial':listingType==='rental'?'personal':null;
    const payload={
      title,
      brand,
      model_name:modelName,
      price:Number(b.price||0),
      grade:String(b.grade||'A급'),
      status:String(b.status||'판매중'),
      year_text:String(b.year_text||'').trim()||null,
      region:String(b.region||'').trim()||null,
      description:String(b.description||'').trim()||null,
      warranty_text:String(b.warranty_text||'').trim()||null,
      thumbnail_url:thumbnail,
      photo_urls:photos,
      stock_qty:Math.max(0,Number(b.stock_qty??1)),
      is_visible:b.is_visible!==false,
      is_featured:b.is_featured===true,
      listing_type:listingType,
      rental_type:rentalType,
      monthly_fee:Math.max(0,Number(b.monthly_fee||0)),
      deposit_amount:Math.max(0,Number(b.deposit_amount||0)),
      setup_fee:Math.max(0,Number(b.setup_fee||0)),
      contract_months:Math.max(0,Math.trunc(Number(b.contract_months||0))),
      installation_regions:String(b.installation_regions||'').trim()||null,
      rental_notes:String(b.rental_notes||'').trim()||null,
      updated_at:new Date().toISOString(),
      // legacy compatibility
      name:title,
      model:modelName,
      image_url:thumbnail,
    };
    const {data,error}=await supabase.from('products').insert(payload).select().single();
    if(error){
      console.error('product insert error',error);
      throw new Error(`상품 DB 저장 오류: ${error.message}`);
    }
    return NextResponse.json({data},{status:201});
  }catch(error){
    if(error instanceof Error&&error.message==='ADMIN_UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    const message=error instanceof Error?error.message:'상품 등록 오류';
    console.error('products POST error',error);
    return NextResponse.json({error:message},{status:500});
  }
}
