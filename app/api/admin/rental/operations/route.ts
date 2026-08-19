import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';

function kstToday(){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(new Date());
}

function daysBetween(from:string,to:string){
  const start=new Date(`${from}T00:00:00+09:00`).getTime();
  const end=new Date(`${to}T00:00:00+09:00`).getTime();
  return Math.ceil((end-start)/(24*60*60*1000));
}

export async function GET(req:NextRequest){
  try{
    await requireAdmin();
    const supabase=getSupabaseServer();
    const keyword=String(req.nextUrl.searchParams.get('q')||'').trim();
    const today=kstToday();

    let consultationQuery=supabase
      .from('consultations')
      .select('*')
      .ilike('service_type','%렌탈%')
      .order('updated_at',{ascending:false})
      .limit(500);

    if(keyword){
      const safe=keyword.replace(/[%_,]/g,' ');
      consultationQuery=consultationQuery.or(
        `customer_name.ilike.%${safe}%,phone.ilike.%${safe}%,rental_contract_no.ilike.%${safe}%,product_title.ilike.%${safe}%`
      );
    }

    const {data:consultations,error:consultationError}=await consultationQuery;
    if(consultationError)throw consultationError;

    const ids=(consultations||[]).map((item:any)=>item.id).filter(Boolean);
    let payments:any[]=[];
    let retrievals:any[]=[];
    let assets:any[]=[];
    if(ids.length){
      const [paymentResult,retrievalResult]=await Promise.all([
        supabase.from('rental_payments').select('*')
          .in('consultation_id',ids)
          .order('due_date',{ascending:true}),
        supabase.from('service_schedules').select('*')
          .in('consultation_id',ids)
          .eq('schedule_kind','rental_retrieval')
          .neq('status','취소')
          .order('scheduled_at',{ascending:false}),
      ]);
      if(paymentResult.error)throw paymentResult.error;
      if(retrievalResult.error)throw retrievalResult.error;
      payments=paymentResult.data||[];
      retrievals=retrievalResult.data||[];
    }

    const assetIds=(consultations||[])
      .map((item:any)=>item.rental_asset_id)
      .filter(Boolean);
    if(assetIds.length){
      const {data,error}=await supabase
        .from('rental_assets')
        .select('id,asset_no,serial_number,status,condition_grade,location_type,location_text')
        .in('id',assetIds);
      if(error)throw error;
      assets=data||[];
    }

    const rows=(consultations||[]).map((consultation:any)=>{
      const own=payments.filter((payment:any)=>payment.consultation_id===consultation.id);
      const unpaid=own.filter((payment:any)=>payment.status==='납부예정');
      const overdue=unpaid.filter((payment:any)=>payment.due_date<today);
      const nextPayment=unpaid.find((payment:any)=>payment.due_date>=today)||overdue[0]||null;
      const paid=own.filter((payment:any)=>payment.status==='납부완료');
      const retrieval=retrievals.find((item:any)=>item.consultation_id===consultation.id)||null;
      const asset=assets.find((item:any)=>item.id===consultation.rental_asset_id)||null;
      const contractDays=consultation.rental_end_date
        ?daysBetween(today,String(consultation.rental_end_date))
        :null;
      const billingStatus=overdue.length
        ?'미납'
        :own.length===0&&consultation.rental_stage==='운영중'
          ?'청구미생성'
          :nextPayment
            ?'납부예정'
            :paid.length
              ?'정상'
              :'대기';
      const retrievalApproved=retrieval?.report_approval_status==='승인';
      const retrievalRequired=
        consultation.rental_stage==='계약종료'&&
        !retrieval&&
        !consultation.rental_retrieval_completed_at;
      const retrievalActive=Boolean(retrieval&&!retrievalApproved);
      const retrievalStatus=retrievalApproved
        ?'회수완료'
        :retrieval?.report_approval_status==='반려'
          ?'보고반려'
          :retrieval?.status==='완료'
            ?'검토대기'
            :retrieval
              ?retrieval.status
              :retrievalRequired
                ?'회수일정필요'
                :'미대상';

      return {
        ...consultation,
        billing_status:billingStatus,
        payment_count:own.length,
        paid_count:paid.length,
        overdue_count:overdue.length,
        total_paid:paid.reduce((sum:number,item:any)=>sum+Number(item.amount||0),0),
        next_due_date:nextPayment?.due_date||null,
        next_due_amount:nextPayment?Number(nextPayment.amount||0):null,
        contract_days_remaining:contractDays,
        contract_expiring:contractDays!==null&&contractDays>=0&&contractDays<=60,
        contract_expired:contractDays!==null&&contractDays<0,
        retrieval_schedule_id:retrieval?.id||null,
        retrieval_status:retrievalStatus,
        retrieval_required:retrievalRequired,
        retrieval_active:retrievalActive,
        retrieval_completed:retrievalApproved,
        rental_asset_no:asset?.asset_no||null,
        rental_asset_serial:asset?.serial_number||null,
        rental_asset_status:asset?.status||null,
        rental_asset_grade:asset?.condition_grade||null,
        rental_asset_location:asset
          ?[asset.location_type,asset.location_text].filter(Boolean).join(' · ')
          :null,
      };
    });

    const summary={
      total:rows.length,
      operating:rows.filter((row:any)=>row.rental_stage==='운영중').length,
      overdue:rows.filter((row:any)=>row.billing_status==='미납').length,
      no_schedule:rows.filter((row:any)=>row.billing_status==='청구미생성').length,
      expiring:rows.filter((row:any)=>row.contract_expiring).length,
      expired:rows.filter((row:any)=>row.contract_expired).length,
      retrieval_required:rows.filter((row:any)=>row.retrieval_required).length,
      retrieval_active:rows.filter((row:any)=>row.retrieval_active).length,
      retrieval_completed:rows.filter((row:any)=>row.retrieval_completed).length,
    };

    return NextResponse.json({data:rows,summary,today});
  }catch(error:unknown){
    if(error instanceof Error&&(
      error.message==='ADMIN_UNAUTHORIZED'||error.message==='UNAUTHORIZED'
    )){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('rental operations load error',error);
    return NextResponse.json({
      error:error instanceof Error?error.message:'렌탈 운영현황 조회 오류',
    },{status:500});
  }
}
