import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function PATCH(req:NextRequest,{params}:{params:{id:string}}){
 const supabase=getSupabase(); const body=await req.json();
 if(!supabase) return NextResponse.json({ok:true,item:{id:params.id,...body}});
 const {data,error}=await supabase.from('consultations').update(body).eq('id',params.id).select().single();
 if(error) return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({ok:true,item:data});
}
