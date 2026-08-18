import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {normalizeScheduleKind} from '@/lib/scheduleKind';

export async function GET(req:NextRequest){
  try{
    const url=new URL(req.url);
    const date=url.searchParams.get('date');
    const view=url.searchParams.get('view')||'day';
    let query=getSupabaseServer()
      .from('service_schedules')
      .select('*')
      .order('scheduled_at',{ascending:true});

    if(date){
      const start=new Date(`${date}T00:00:00`);
      const end=new Date(start);
      if(view==='week')end.setDate(end.getDate()+7);
      else end.setHours(23,59,59,999);
      query=query
        .gte('scheduled_at',start.toISOString())
        .lt('scheduled_at',end.toISOString());
    }

    const {data,error}=await query;
    if(error)throw error;

    return NextResponse.json({
      data:(data||[]).map(item=>({
        ...item,
        schedule_kind:normalizeScheduleKind(item),
      })),
    });
  }catch(error:unknown){
    return NextResponse.json({
      error:error instanceof Error?error.message:'일정 조회 오류',
    },{status:500});
  }
}
