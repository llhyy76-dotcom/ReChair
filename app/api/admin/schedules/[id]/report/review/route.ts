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

    return NextResponse.json({
      success:true,
      data,
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
