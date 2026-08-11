import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';

const STATUSES=['배정대기','배정완료','이동중','방문중','작업중','완료','취소'];

export async function PATCH(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const body=await req.json();

    if(!STATUSES.includes(String(body.status||''))){
      return NextResponse.json({error:'허용되지 않은 상태입니다.'},{status:400});
    }

    const scheduledAt=new Date(body.scheduled_at||'');
    if(Number.isNaN(scheduledAt.getTime())){
      return NextResponse.json({error:'올바른 방문 일시를 입력해 주세요.'},{status:400});
    }

    const requestedDuration=Number(body.duration_minutes||60);
    if(!Number.isFinite(requestedDuration)){
      return NextResponse.json({error:'소요시간을 숫자로 입력해 주세요.'},{status:400});
    }
    const durationMinutes=Math.max(10,Math.min(480,requestedDuration));
    const supabase=getSupabaseServer();
    const {data:current,error:currentError}=await supabase
      .from('service_schedules')
      .select('*')
      .eq('id',id)
      .single();

    if(currentError||!current){
      return NextResponse.json({error:'수정할 일정을 찾을 수 없습니다.'},{status:404});
    }

    if(current.report_approval_status==='승인'){
      return NextResponse.json({error:'관리자 승인이 끝난 일정은 변경할 수 없습니다.'},{status:409});
    }

    const now=new Date().toISOString();
    const payload={
      scheduled_at:scheduledAt.toISOString(),
      assignee:String(body.assignee||'').trim()||null,
      duration_minutes:durationMinutes,
      status:String(body.status),
      address:String(body.address||'').trim()||null,
      memo:String(body.memo||'').trim()||null,
      updated_at:now,
    };

    const {data,error}=await supabase
      .from('service_schedules')
      .update(payload)
      .eq('id',id)
      .select('*')
      .single();
    if(error)throw error;

    if(data?.consultation_id){
      const isRentalInstallation=data.schedule_kind==='rental_installation';
      const consultationPayload:Record<string,unknown>={
        assignee:payload.assignee,
        next_action_at:payload.status==='취소'?null:payload.scheduled_at,
        updated_at:now,
      };

      if(isRentalInstallation){
        if(payload.status==='취소'){
          consultationPayload.rental_stage='계약완료';
          consultationPayload.status='계약완료';
          consultationPayload.rental_installation_at=null;
          consultationPayload.rental_stage_updated_at=now;
        }else{
          consultationPayload.rental_stage='설치예약';
          consultationPayload.status='예약완료';
          consultationPayload.rental_installation_at=payload.scheduled_at;
          consultationPayload.rental_stage_updated_at=now;
        }
      }else if(payload.status==='완료'){
        consultationPayload.status='방문완료';
      }

      const {error:consultationError}=await supabase
        .from('consultations')
        .update(consultationPayload)
        .eq('id',data.consultation_id);
      if(consultationError)throw consultationError;
    }

    return NextResponse.json({data});
  }catch(error:unknown){
    if(error instanceof Error&&(
      error.message==='ADMIN_UNAUTHORIZED'||error.message==='UNAUTHORIZED'
    )){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('admin schedule update error',error);
    return NextResponse.json({
      error:error instanceof Error?error.message:'일정 저장 오류',
    },{status:500});
  }
}
