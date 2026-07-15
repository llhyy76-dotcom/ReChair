import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function GET(){
  try{
    const {data,error}=await getSupabaseServer()
      .from('technicians')
      .select('*')
      .order('is_active',{ascending:false})
      .order('name',{ascending:true});

    if(error)throw error;
    return NextResponse.json({data:data||[]});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'기사 조회 오류'},{status:500});
  }
}

export async function POST(req:NextRequest){
  try{
    const b=await req.json();
    if(!String(b.name||'').trim()){
      return NextResponse.json({error:'기사명 또는 팀명이 필요합니다.'},{status:400});
    }

    const payload={
      name:String(b.name).trim(),
      phone:b.phone||null,
      region:b.region||null,
      team_name:b.team_name||null,
      daily_capacity:Number(b.daily_capacity||5),
      is_active:b.is_active!==false,
      memo:b.memo||null,
    };

    const {data,error}=await getSupabaseServer()
      .from('technicians')
      .insert(payload)
      .select('*')
      .single();

    if(error)throw error;
    return NextResponse.json({data},{status:201});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'기사 등록 오류'},{status:500});
  }
}
