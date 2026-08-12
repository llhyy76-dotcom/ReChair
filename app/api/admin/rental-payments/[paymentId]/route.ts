import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

const STATUSES=['납부예정','납부완료','면제','취소'];

export async function PATCH(
  req:NextRequest,
  {params}:{params:Promise<{paymentId:string}>}
){
  try{
    await requireAdmin();
    const {paymentId}=await params;
    const body=await req.json();
    const status=String(body.status||'');
    if(!STATUSES.includes(status)){
      return NextResponse.json({error:'허용되지 않은 납부상태입니다.'},{status:400});
    }

    const amount=Number(body.amount||0);
    if(!Number.isFinite(amount)||amount<0){
      return NextResponse.json({error:'납부금액은 0원 이상의 숫자여야 합니다.'},{status:400});
    }

    const paidAtText=String(body.paid_at||'').trim();
    const paidAt=status==='납부완료'
      ?paidAtText?new Date(paidAtText):new Date()
      :null;
    if(paidAt&&Number.isNaN(paidAt.getTime())){
      return NextResponse.json({error:'납부일시가 올바르지 않습니다.'},{status:400});
    }

    const payload={
      status,
      amount,
      paid_at:paidAt?.toISOString()||null,
      payment_method:status==='납부완료'
        ?String(body.payment_method||'').trim()||null
        :null,
      memo:String(body.memo||'').trim().slice(0,1000)||null,
      updated_at:new Date().toISOString(),
    };

    const {data,error}=await getSupabaseServer()
      .from('rental_payments')
      .update(payload)
      .eq('id',paymentId)
      .select('*')
      .single();
    if(error)throw error;
    return NextResponse.json({success:true,data});
  }catch(error:unknown){
    if(error instanceof Error&&(
      error.message==='ADMIN_UNAUTHORIZED'||error.message==='UNAUTHORIZED'
    )){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('rental payment update error',error);
    return NextResponse.json({
      error:error instanceof Error?error.message:'렌탈 납부내역 저장 오류',
    },{status:500});
  }
}

