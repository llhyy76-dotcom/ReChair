import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';
import {kstDayRange} from '@/lib/dispatchRecommendation';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  try{
    await requireAdmin();

    const url=new URL(req.url);
    const date=String(
      url.searchParams.get('date')||
      new Intl.DateTimeFormat('en-CA',{
        timeZone:'Asia/Seoul',
        year:'numeric',
        month:'2-digit',
        day:'2-digit',
      }).format(new Date())
    );
    const {start,end}=kstDayRange(date);
    const supabase=getSupabaseServer();

    const [technicianResult,scheduleResult,consultationResult]=await Promise.all([
      supabase
        .from('technicians')
        .select('*')
        .order('is_active',{ascending:false})
        .order('name',{ascending:true}),
      supabase
        .from('service_schedules')
        .select('assignee,status,scheduled_at,duration_minutes')
        .gte('scheduled_at',start)
        .lt('scheduled_at',end)
        .neq('status','취소'),
      supabase
        .from('consultations')
        .select(`
          id,
          customer_name,
          phone,
          region,
          address,
          service_type,
          created_at,
          status,
          next_action_at
        `)
        .in('status',['신규','상담중'])
        .is('next_action_at',null)
        .order('created_at',{ascending:true})
        .limit(100),
    ]);

    if(technicianResult.error)throw technicianResult.error;
    if(scheduleResult.error)throw scheduleResult.error;
    if(consultationResult.error)throw consultationResult.error;

    const technicians=(technicianResult.data||[]).map((technician:any)=>{
      const count=(scheduleResult.data||[]).filter(
        (schedule:any)=>schedule.assignee===technician.name
      ).length;
      const capacity=Math.max(1,Number(technician.daily_capacity||5));
      return {
        ...technician,
        today_count:count,
        remaining_capacity:Math.max(0,capacity-count),
      };
    });

    return NextResponse.json({
      data:{
        date,
        technicians,
        waiting_consultations:consultationResult.data||[],
      },
    });
  }catch(error:any){
    if(
      error?.message==='ADMIN_UNAUTHORIZED'||
      error?.message==='UNAUTHORIZED'
    ){
      return NextResponse.json(
        {error:'관리자 로그인이 필요합니다.'},
        {status:401}
      );
    }

    console.error('dispatch overview error',error);
    return NextResponse.json(
      {error:error?.message||'배정 현황 조회 오류'},
      {status:500}
    );
  }
}
