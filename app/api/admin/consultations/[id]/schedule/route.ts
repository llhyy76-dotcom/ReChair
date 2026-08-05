import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';
import {kstDayRange,overlaps} from '@/lib/dispatchRecommendation';

export async function POST(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();

    const {id}=await params;
    const body=await req.json();

    if(!body.scheduled_at){
      return NextResponse.json(
        {error:'방문 일시가 필요합니다.'},
        {status:400}
      );
    }

    const requestedStart=new Date(body.scheduled_at);
    if(Number.isNaN(requestedStart.getTime())){
      return NextResponse.json(
        {error:'올바른 방문 일시가 아닙니다.'},
        {status:400}
      );
    }

    const durationMinutes=Math.max(
      15,
      Math.min(480,Number(body.duration_minutes||60))
    );
    const requestedRegion=String(body.region||'').trim();
    const requestedAddress=String(body.address||'').trim();

    if(!requestedRegion||!requestedAddress){
      return NextResponse.json(
        {error:'정확한 자동배정을 위해 지역과 주소를 모두 입력해 주세요.'},
        {status:400}
      );
    }
    const assignee=String(body.assignee||'').trim()||null;
    const supabase=getSupabaseServer();

    const {data:consultation,error:consultationError}=await supabase
      .from('consultations')
      .select('*')
      .eq('id',id)
      .single();

    if(consultationError||!consultation){
      return NextResponse.json(
        {error:'배정할 상담을 찾을 수 없습니다.'},
        {status:404}
      );
    }

    const {data:duplicateSchedule,error:duplicateError}=await supabase
      .from('service_schedules')
      .select('id,status,scheduled_at')
      .eq('consultation_id',id)
      .neq('status','취소')
      .maybeSingle();

    if(duplicateError)throw duplicateError;
    if(duplicateSchedule){
      return NextResponse.json(
        {
          error:'이미 생성된 일정이 있습니다. AS 캘린더에서 기존 일정을 확인해 주세요.',
          schedule_id:duplicateSchedule.id,
        },
        {status:409}
      );
    }

    if(assignee){
      const {data:technician,error:technicianError}=await supabase
        .from('technicians')
        .select('id,name,is_active,daily_capacity')
        .eq('name',assignee)
        .single();

      if(technicianError||!technician||!technician.is_active){
        return NextResponse.json(
          {error:'활성 상태의 기사에게만 배정할 수 있습니다.'},
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

      const {data:existing,error:existingError}=await supabase
        .from('service_schedules')
        .select('id,assignee,scheduled_at,duration_minutes,status')
        .eq('assignee',assignee)
        .gte('scheduled_at',start)
        .lt('scheduled_at',end)
        .neq('status','취소');

      if(existingError)throw existingError;

      const conflict=(existing||[]).find(schedule=>
        overlaps(schedule,requestedStart,durationMinutes)
      );

      if(conflict){
        return NextResponse.json(
          {
            error:'선택한 기사에게 같은 시간대의 일정이 있습니다. 추천을 다시 계산해 주세요.',
            conflict_schedule_id:conflict.id,
          },
          {status:409}
        );
      }

      const capacity=Math.max(1,Number(technician.daily_capacity||5));
      if((existing||[]).length>=capacity){
        return NextResponse.json(
          {error:'선택한 기사의 일일 처리한도를 초과합니다.'},
          {status:409}
        );
      }
    }

    const now=new Date().toISOString();
    const payload={
      consultation_id:id,
      customer_name:
        consultation.customer_name??consultation.name??'이름 없음',
      phone:consultation.phone??null,
      region:
        requestedRegion||String(consultation.region||'').trim()||null,
      address:
        String(
          requestedAddress||
          consultation.address||
          body.region||
          consultation.region||
          ''
        ).trim()||null,
      service_type:
        consultation.service_type??
        consultation.service??
        '미분류',
      assignee,
      scheduled_at:requestedStart.toISOString(),
      duration_minutes:durationMinutes,
      status:assignee?'배정완료':'배정대기',
      memo:body.memo||consultation.memo||null,
    };

    const {data,error}=await supabase
      .from('service_schedules')
      .insert(payload)
      .select('*')
      .single();

    if(error)throw error;

    const {error:updateError}=await supabase
      .from('consultations')
      .update({
        region:
          requestedRegion||String(consultation.region||'').trim()||null,
        address:
          String(
            body.address||
            consultation.address||
            body.region||
            consultation.region||
            ''
          ).trim()||null,
        next_action_at:requestedStart.toISOString(),
        assignee,
        status:consultation.status==='신규'
          ?'예약완료'
          :consultation.status,
        updated_at:now,
      })
      .eq('id',id);

    if(updateError)throw updateError;

    return NextResponse.json({data},{status:201});
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

    console.error('consultation schedule create error',error);
    return NextResponse.json(
      {error:error?.message||'일정 생성 오류'},
      {status:500}
    );
  }
}
