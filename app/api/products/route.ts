import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(request:NextRequest){
  try{
    const supabase=getSupabaseServer();
    let query=supabase.from('products').select('*').order('is_featured',{ascending:false}).order('created_at',{ascending:false});
    if(request.nextUrl.searchParams.get('visible')==='true')query=query.eq('is_visible',true);
    const {data,error}=await query;
    if(error)throw error;
    return NextResponse.json({data});
  }catch(error){
    const message=error instanceof Error?error.message:'상품 조회 오류';
    console.error('products GET error',error);
    return NextResponse.json({error:message},{status:500});
  }
}

export async function POST(request:NextRequest){
  try{
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
    const message=error instanceof Error?error.message:'상품 등록 오류';
    console.error('products POST error',error);
    return NextResponse.json({error:message},{status:500});
  }
}
