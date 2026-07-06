import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
export const dynamic='force-dynamic';
const demo=[{id:'demo-cmc-a100',title:'코지마 CMC-A100',brand:'코지마',model:'CMC-A100',price:890000,status:'판매중',grade:'A',description:'상태 양호한 중고 안마의자입니다.',image_url:''}];
export async function GET(){const supabase=getSupabase(); if(!supabase) return NextResponse.json({items:demo}); const {data,error}=await supabase.from('products').select('*').order('created_at',{ascending:false}); if(error) return NextResponse.json({items:demo}); return NextResponse.json({items:data&&data.length?data:demo});}
export async function POST(req:NextRequest){const supabase=getSupabase(); const body=await req.json(); if(!supabase) return NextResponse.json({ok:true,item:{id:Date.now().toString(),...body}}); const {data,error}=await supabase.from('products').insert(body).select().single(); if(error) return NextResponse.json({error:error.message},{status:500}); return NextResponse.json({ok:true,item:data});}
