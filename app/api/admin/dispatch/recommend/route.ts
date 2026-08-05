import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';
import {
  kstDayRange,
  scoreTechnician,
} from '@/lib/dispatchRecommendation';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  try{
    await requireAdmin();

    const url=new URL(req.url);
    const scheduledAt=String(url.searchParams.get('scheduled_at')||'').trim();
    const durationMinutes=Math.max(
      15,
      Math.min(480,Number(url.searchParams.get('duration_minutes')||60))
    );
    const region=String(url.searchParams.get('region')||'').trim();
    const address=String(url.searchParams.get('address')||'').trim();

    if(!scheduledAt){
      return NextResponse.json(
        {error:'추천할 방문 일시가 필요합니다.'},
        {status:400}
      );
    }

    const requestedStart=new Date(scheduledAt);
    if(Number.isNaN(requestedStart.getTime())){
      return NextResponse.json(
        {error:'올바른 방문 일시가 아닙니다.'},
        {status:400}
      );
    }

    const dateText=new Intl.DateTimeFormat('en-CA',{
      timeZone:'Asia/Seoul',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
    }).format(requestedStart);
    const {start,end}=kstDayRange(dateText);
    const supabase=getSupabaseServer();

    const [technicianResult,scheduleResult,availabilityResult]=await Promise.all([
      supabase
        .from('technicians')
        .select('*')
        .eq('is_active',true)
        .order('name',{ascending:true}),
      supabase
        .from('service_schedules')
        .select(`
          id,
          assignee,
          scheduled_at,
          duration_minutes,
          status,
          address,
          region
        `)
        .gte('scheduled_at',start)
        .lt('scheduled_at',end)
        .neq('status','취소'),
      supabase
        .from('technician_availability')
        .select('technician_id,availability_type,start_time,end_time,note')
        .eq('work_date',dateText),
    ]);

    if(technicianResult.error)throw technicianResult.error;
    if(scheduleResult.error)throw scheduleResult.error;
    if(availabilityResult.error)throw availabilityResult.error;

    const candidates=(technicianResult.data||[])
      .map(technician=>scoreTechnician({
        technician,
        schedules:scheduleResult.data||[],
        requestedStart,
        requestedDuration:durationMinutes,
        region,
        address,
        availability:(availabilityResult.data||[]).find(
          (row:any)=>row.technician_id===technician.id
        )||null,
      }))
      .sort((a,b)=>{
        if(a.eligible!==b.eligible)return a.eligible?-1:1;
        if(b.score!==a.score)return b.score-a.score;
        return a.today_count-b.today_count;
      });

    const best=candidates.find(candidate=>candidate.eligible)||null;

    return NextResponse.json({
      data:{
        technician:best,
        candidates:candidates.slice(0,8),
        requested_at:requestedStart.toISOString(),
        duration_minutes:durationMinutes,
        reason:best
          ?best.reasons.join(' · ')
          :'시간 충돌 또는 처리한도 초과로 추천 가능한 기사가 없습니다.',
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

    console.error('dispatch recommendation error',error);
    return NextResponse.json(
      {error:error?.message||'추천 기사 조회 오류'},
      {status:500}
    );
  }
}
