import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function PATCH(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const {id}=await params;
    const b=await req.json();

    const payload={
      name:String(b.name||'').trim(),
      phone:b.phone||null,
      region:b.region||null,
      team_name:b.team_name||null,
      daily_capacity:Number(b.daily_capacity||5),
      is_active:b.is_active!==false,
      memo:b.memo||null,
      updated_at:new Date().toISOString(),
    };

    if(!payload.name){
      return NextResponse.json({error:'기사명 또는 팀명이 필요합니다.'},{status:400});
    }

    const {data,error}=await getSupabaseServer()
      .from('technicians')
      .update(payload)
      .eq('id',id)
      .select('*')
      .single();

    if(error)throw error;
    return NextResponse.json({data});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'기사 저장 오류'},{status:500});
  }
}
