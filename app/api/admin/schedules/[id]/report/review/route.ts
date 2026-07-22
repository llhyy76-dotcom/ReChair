import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';

export const dynamic='force-dynamic';

const ALLOWED_STATUSES=[
  '검토대기',
  '승인',
  '반려',
];

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

    if(!ALLOWED_STATUSES.includes(approvalStatus)){
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

    const {data:schedule,error:loadError}=await supabase
      .from('service_schedules')
      .select(`
        id,
        customer_name,
        status,
        symptom_text,
        action_text,
        customer_signature_url
      `)
      .eq('id',id)
      .single();

    if(loadError||!schedule){
      return NextResponse.json(
        {
          error:'검토할 작업보고를 찾을 수 없습니다.',
        },
        {
          status:404,
        }
      );
    }

    if(schedule.status!=='완료'){
      return NextResponse.json(
        {
          error:'완료된 일정만 승인하거나 반려할 수 있습니다.',
        },
        {
          status:400,
        }
      );
    }

    const payload={
      report_approval_status:approvalStatus,

      report_rejection_reason:
        approvalStatus==='반려'
          ? rejectionReason
          : null,

      report_reviewed_at:
        approvalStatus==='검토대기'
          ? null
          : new Date().toISOString(),

      report_reviewed_by:
        approvalStatus==='검토대기'
          ? null
          : '관리자',
    };

    const {data,error}=await supabase
      .from('service_schedules')
      .update(payload)
      .eq('id',id)
      .select(`
        id,
        report_approval_status,
        report_rejection_reason,
        report_reviewed_at,
        report_reviewed_by
      `)
      .single();

    if(error){
      throw error;
    }

    return NextResponse.json({
      success:true,
      data,
    });
  }catch(error:any){
    if(error?.message==='ADMIN_UNAUTHORIZED'){
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
