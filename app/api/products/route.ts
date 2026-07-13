import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(request:NextRequest){
  try{
    const supabase=getSupabaseServer();
    let query=supabase.from('products').select('*').order('is_featured',{ascending:false}).order('created_at',{ascending:false});
    if(request.nextUrl.searchParams.get('visible')==='true')query=query.eq('is_visible',true);
    const {data,error}=await query;if(error)throw error;return NextResponse.json({data});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'상품 조회 오류'},{status:500})}
}

export async function POST(request:NextRequest){
  try{
    const b=await request.json();const supabase=getSupabaseServer();
    const payload={brand:String(b.brand||'').trim(),model_name:String(b.model_name||'').trim(),title:String(b.title||'').trim(),price:Number(b.price||0),grade:String(b.grade||'A급'),status:String(b.status||'판매중'),year_text:b.year_text||null,region:b.region||null,description:b.description||null,warranty_text:b.warranty_text||null,thumbnail_url:b.thumbnail_url||null,photo_urls:Array.isArray(b.photo_urls)?b.photo_urls:[],stock_qty:Number(b.stock_qty||1),is_visible:b.is_visible!==false,is_featured:b.is_featured===true};
    if(!payload.brand||!payload.model_name||!payload.title)return NextResponse.json({error:'브랜드, 모델명, 상품명은 필수입니다.'},{status:400});
    const {data,error}=await supabase.from('products').insert(payload).select().single();if(error)throw error;return NextResponse.json({data},{status:201});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'상품 등록 오류'},{status:500})}
}
