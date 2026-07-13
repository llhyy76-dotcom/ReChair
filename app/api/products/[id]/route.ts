import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
type Ctx={params:Promise<{id:string}>};

export async function PATCH(request:NextRequest,ctx:Ctx){
  try{const {id}=await ctx.params;const body=await request.json();const supabase=getSupabaseServer();const {data,error}=await supabase.from('products').update({...body,updated_at:new Date().toISOString()}).eq('id',id).select().single();if(error)throw error;return NextResponse.json({data})}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:'상품 수정 오류'},{status:500})}
}
export async function DELETE(_:NextRequest,ctx:Ctx){
  try{const {id}=await ctx.params;const supabase=getSupabaseServer();const {error}=await supabase.from('products').delete().eq('id',id);if(error)throw error;return NextResponse.json({success:true})}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:'상품 삭제 오류'},{status:500})}
}
