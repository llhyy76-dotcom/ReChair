import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireTechnicianSession} from '@/lib/technicianAuth';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  try{
    // 로그인된 기사 세션 확인
    const session=await requireTechnicianSession();

    const url=new URL(req.url);
    const date=url.searchParams.get('date');

    if(!date){
      return NextResponse.json(
        {error:'조회할 일자가 필요합니다.'},
        {status:400}
      );
    }

    const technicianName=session.technician.name;

    if(!technicianName){
      return NextResponse.json(
        {error:'로그인된 기사 정보를 확인할 수 없습니다.'},
        {status:401}
      );
    }

    // 한국시간 기준 조회 범위
    const start=new Date(`${date}T00:00:00+09:00`);
    const end=new Date(start.getTime()+24*60*60*1000);

    const supabase=getSupabaseServer();

    const {data,error}=await supabase
      .from('service_schedules')
      .select('*')
      .eq('assignee',technicianName)
      .gte('scheduled_at',start.toISOString())
      .lt('scheduled_at',end.toISOString())
      .neq('status','취소')
      .order('route_order',{
        ascending:true,
        nullsFirst:false,
      })
      .order('scheduled_at',{
        ascending:true,
      });

    if(error){
      throw error;
    }

    return NextResponse.json({
      data:data||[],
      technician:{
        id:session.technician_id,
        name:technicianName,
      },
    });
  }catch(e:any){
    if(e?.message==='TECHNICIAN_UNAUTHORIZED'){
      return NextResponse.json(
        {error:'기사 로그인이 필요합니다.'},
        {status:401}
      );
    }

    console.error('technician assignments error',e);

    return NextResponse.json(
      {error:e?.message||'기사 일정 조회 오류'},
      {status:500}
    );
  }
}
