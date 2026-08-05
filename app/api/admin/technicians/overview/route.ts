import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';
import {kstDayRange} from '@/lib/dispatchRecommendation';

export const dynamic='force-dynamic';

function validDate(value:string){
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req:NextRequest){
  try{
    await requireAdmin();

    const url=new URL(req.url);
    const requestedDate=String(url.searchParams.get('date')||'').trim();
    const date=validDate(requestedDate)
      ?requestedDate
      :new Intl.DateTimeFormat('en-CA',{
          timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
        }).format(new Date());

    const {start,end}=kstDayRange(date);
    const supabase=getSupabaseServer();

    const [techniciansResult,schedulesResult,availabilityResult]=await Promise.all([
      supabase
        .from('technicians')
        .select('*')
        .order('is_active',{ascending:false})
        .order('name',{ascending:true}),
      supabase
        .from('service_schedules')
        .select(`
          id,
          assignee,
          scheduled_at,
          duration_minutes,
          status,
          completed_at,
          report_approval_status,
          report_rejection_reason
        `)
        .gte('scheduled_at',start)
        .lt('scheduled_at',end)
        .neq('status','취소'),
      supabase
        .from('technician_availability')
        .select(`
          id,
          technician_id,
          work_date,
          availability_type,
          start_time,
          end_time,
          note
        `)
        .eq('work_date',date),
    ]);

    if(techniciansResult.error)throw techniciansResult.error;
    if(schedulesResult.error)throw schedulesResult.error;
    if(availabilityResult.error)throw availabilityResult.error;

    const schedules=schedulesResult.data||[];
    const availabilityMap=new Map(
      (availabilityResult.data||[]).map(row=>[row.technician_id,row])
    );

    const rows=(techniciansResult.data||[]).map(technician=>{
      const own=schedules.filter(row=>row.assignee===technician.name);
      const approved=own.filter(row=>row.report_approval_status==='승인').length;
      const reviewPending=own.filter(row=>
        row.report_approval_status==='검토대기'||
        (!row.report_approval_status&&Boolean(row.completed_at))
      ).length;
      const rejected=own.filter(row=>row.report_approval_status==='반려').length;
      const active=own.filter(row=>
        ['이동중','방문중','작업중'].includes(String(row.status||''))
      ).length;
      const scheduled=own.filter(row=>
        ['배정대기','배정완료'].includes(String(row.status||''))
      ).length;
      const capacity=Math.max(1,Number(technician.daily_capacity||5));
      const utilization=Math.min(999,Math.round((own.length/capacity)*100));
      const availability=availabilityMap.get(technician.id)||null;

      return {
        ...technician,
        work_date:date,
        today_count:own.length,
        scheduled_count:scheduled,
        active_count:active,
        review_pending_count:reviewPending,
        approved_count:approved,
        rejected_count:rejected,
        remaining_capacity:Math.max(0,capacity-own.length),
        utilization_percent:utilization,
        availability_type:availability?.availability_type||'기본근무',
        availability_start_time:availability?.start_time||null,
        availability_end_time:availability?.end_time||null,
        availability_note:availability?.note||null,
      };
    });

    const summary={
      date,
      total:rows.length,
      active_technicians:rows.filter(row=>row.is_active).length,
      available_technicians:rows.filter(row=>
        row.is_active&&['근무','기본근무'].includes(row.availability_type)
      ).length,
      unavailable_technicians:rows.filter(row=>
        row.is_active&&!['근무','기본근무'].includes(row.availability_type)
      ).length,
      total_capacity:rows
        .filter(row=>row.is_active)
        .reduce((sum,row)=>sum+Number(row.daily_capacity||0),0),
      assigned_count:rows.reduce((sum,row)=>sum+row.today_count,0),
      remaining_capacity:rows
        .filter(row=>row.is_active)
        .reduce((sum,row)=>sum+row.remaining_capacity,0),
      review_pending_count:rows.reduce((sum,row)=>sum+row.review_pending_count,0),
      rejected_count:rows.reduce((sum,row)=>sum+row.rejected_count,0),
    };

    return NextResponse.json({data:rows,summary});
  }catch(error:any){
    if(error?.message==='ADMIN_UNAUTHORIZED'||error?.message==='UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }

    console.error('technician overview error',error);
    return NextResponse.json(
      {error:error?.message||'기사 운영현황 조회 오류'},
      {status:500}
    );
  }
}
