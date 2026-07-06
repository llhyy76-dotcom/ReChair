import { NextResponse } from 'next/server';
import { supabase, hasSupabase } from '@/lib/supabase';
type Ctx={params:Promise<{id:string}>};
export async function PATCH(req:Request,ctx:Ctx){const {id}=await ctx.params;if(!hasSupabase||!supabase)return NextResponse.json({ok:true});const body=await req.json();const {data,error}=await supabase.from('consultations').update(body).eq('id',id).select().single();if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true,item:data});}
export async function DELETE(req:Request,ctx:Ctx){const {id}=await ctx.params;if(!hasSupabase||!supabase)return NextResponse.json({ok:true});const {error}=await supabase.from('consultations').delete().eq('id',id);if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true});}
