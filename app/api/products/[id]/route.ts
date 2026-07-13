import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
type C={params:Promise<{id:string}>};
export async function PATCH(req:NextRequest,c:C){try{const {id}=await c.params;const body=await req.json();const s=getSupabaseServer();const {data,error}=await s.from('products').update({...body,updated_at:new Date().toISOString()}).eq('id',id).select().single();if(error)throw error;return NextResponse.json({data});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'상품 수정 오류'},{status:500});}}
export async function DELETE(_:NextRequest,c:C){try{const {id}=await c.params;const s=getSupabaseServer();const {error}=await s.from('products').delete().eq('id',id);if(error)throw error;return NextResponse.json({success:true});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'상품 삭제 오류'},{status:500});}}
