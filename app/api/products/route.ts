import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(request:NextRequest) {
  try {
    const supabase=getSupabaseServer();
    let query=supabase.from('products').select('*').order('is_featured',{ascending:false}).order('created_at',{ascending:false});
    if(request.nextUrl.searchParams.get('visible')==='true') query=query.eq('is_visible',true);
    const {data,error}=await query; if(error) throw error;
    return NextResponse.json({data});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:'상품 조회 오류'},{status:500});
  }
}

export async function POST(request:NextRequest) {
  try {
    const body=await request.json(); const supabase=getSupabaseServer();
    const payload={
      brand:String(body.brand||'').trim(),model_name:String(body.model_name||'').trim(),title:String(body.title||'').trim(),
      price:Number(body.price||0),grade:String(body.grade||'A급'),status:String(body.status||'판매중'),
      year_text:body.year_text||null,region:body.region||null,description:body.description||null,warranty_text:body.warranty_text||null,
      thumbnail_url:body.thumbnail_url||null,photo_urls:Array.isArray(body.photo_urls)?body.photo_urls:[],
      stock_qty:Number(body.stock_qty||1),is_visible:body.is_visible!==false,is_featured:body.is_featured===true
    };
    if(!payload.brand||!payload.model_name||!payload.title) return NextResponse.json({error:'브랜드, 모델명, 상품명은 필수입니다.'},{status:400});
    const {data,error}=await supabase.from('products').insert(payload).select().single(); if(error) throw error;
    return NextResponse.json({data},{status:201});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:'상품 등록 오류'},{status:500});
  }
}
