import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';

export const dynamic='force-dynamic';

const ALLOWED_STATUSES=[
  '검토대기',
  '승인',
  '반려',
] as const;

export async function PATCH(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();

    const {id}=await params;
    const body=await req.json();

    const approvalStatus=String(
      body.approval_status||''
    ).trim();

    const rejectionReason=String(
      body.rejection_reason||''
    ).trim();

    if(!ALLOWED_STATUSES.includes(
      approvalStatus as typeof ALLOWED_STATUSES[number]
    )){
      return NextResponse.json(
        {
          error:'올바른 검토 상태가 아닙니다.',
        },
        {
          status:400,
        }
      );
    }

    if(
      approvalStatus==='반려'&&
      !rejectionReason
    ){
      return NextResponse.json(
        {
          error:'반려 사유를 입력하세요.',
        },
        {
          status:400,
        }
      );
    }

    const supabase=getSupabaseServer();

    const {
      data:schedule,
      error:loadError,
    }=await supabase
      .from('service_schedules')
      .select(`
        id,
        consultation_id,
        schedule_kind,
        customer_name,
        status,
        symptom_text,
        action_text,
        customer_signature_url,
        completed_at,
        field_report_updated_at
      `)
      .eq('id',id)
      .single();

    if(loadError||!schedule){
      console.error(
        'admin report review load error',
        loadError
      );

      return NextResponse.json(
        {
          error:'검토할 작업보고를 찾을 수 없습니다.',
        },
        {
          status:404,
        }
      );
    }

    const hasSubmittedReport=Boolean(
      schedule.field_report_updated_at||
      schedule.completed_at||
      schedule.symptom_text||
      schedule.action_text||
      schedule.customer_signature_url
    );

    if(!hasSubmittedReport){
      return NextResponse.json(
        {
          error:'제출된 작업보고가 없어 검토할 수 없습니다.',
        },
        {
          status:400,
        }
      );
    }

    const now=new Date().toISOString();

    const payload={
      status:'완료',

      completed_at:
        schedule.completed_at||now,

      report_approval_status:approvalStatus,

      report_rejection_reason:
        approvalStatus==='반려'
          ? rejectionReason
          : null,

      report_reviewed_at:
        approvalStatus==='검토대기'
          ? null
          : now,

      report_reviewed_by:
        approvalStatus==='검토대기'
          ? null
          : '관리자',
    };

    const {
      data,
      error,
    }=await supabase
      .from('service_schedules')
      .update(payload)
      .eq('id',id)
      .select(`
        id,
        status,
        completed_at,
        report_approval_status,
        report_rejection_reason,
        report_reviewed_at,
        report_reviewed_by
      `)
      .single();

    if(error){
      console.error(
        'admin report review update error',
        error
      );

      return NextResponse.json(
        {
          error:`작업보고 검토 저장 오류: ${error.message}`,
        },
        {
          status:500,
        }
      );
    }

    let consultationUpdated=false;
    if(
      schedule.schedule_kind==='rental_installation'&&
      schedule.consultation_id
    ){
      const consultationPayload:Record<string,unknown>={
        updated_at:now,
        rental_stage_updated_at:now,
      };

      if(approvalStatus==='승인'){
        consultationPayload.rental_stage='운영중';
        consultationPayload.status='운영중';
        consultationPayload.rental_installation_completed_at=
          schedule.completed_at||now;
        consultationPayload.rental_operating_started_at=now;
        consultationPayload.next_action_at=null;
      }else{
        consultationPayload.rental_stage='설치예약';
        consultationPayload.status='예약완료';
      }

      const {error:consultationError}=await supabase
        .from('consultations')
        .update(consultationPayload)
        .eq('id',schedule.consultation_id);

      if(consultationError){
        console.error('rental consultation stage sync error',consultationError);
        return NextResponse.json({
          error:`작업보고는 저장되었지만 렌탈 단계 연동에 실패했습니다: ${consultationError.message}`,
        },{status:500});
      }
      consultationUpdated=true;
    }

    return NextResponse.json({
      success:true,
      data,
      consultation_updated:consultationUpdated,
    });
  }catch(error:any){
    if(
      error?.message==='ADMIN_UNAUTHORIZED'||
      error?.message==='UNAUTHORIZED'
    ){
      return NextResponse.json(
        {
          error:'관리자 로그인이 필요합니다.',
        },
        {
          status:401,
        }
      );
    }

    console.error(
      'admin report review error',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message||
          '작업보고 검토 처리 오류',
      },
      {
        status:500,
      }
    );
  }
}
