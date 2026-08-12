import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';

function dateOnly(value:unknown){
  const text=String(value||'').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:null;
}

function addMonths(dateText:string,months:number){
  const [year,month,day]=dateText.split('-').map(Number);
  const base=new Date(Date.UTC(year,month-1+months,1));
  const lastDay=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0)).getUTCDate();
  const actualDay=Math.min(day,lastDay);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth()+1).padStart(2,'0')}-${String(actualDay).padStart(2,'0')}`;
}

function firstOfMonth(dateText:string){
  return `${dateText.slice(0,7)}-01`;
}

async function rentalConsultation(id:string){
  const supabase=getSupabaseServer();
  const {data,error}=await supabase
    .from('consultations')
    .select('*')
    .eq('id',id)
    .single();
  if(error||!data)throw new Error('RENTAL_NOT_FOUND');
  if(!String(data.service_type||'').includes('렌탈'))throw new Error('NOT_RENTAL');
  return {supabase,consultation:data};
}

export async function GET(
  _req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const {supabase}=await rentalConsultation(id);
    const {data,error}=await supabase
      .from('rental_payments')
      .select('*')
      .eq('consultation_id',id)
      .order('billing_month',{ascending:true});
    if(error)throw error;
    return NextResponse.json({data:data||[]});
  }catch(error:unknown){
    const message=error instanceof Error?error.message:'';
    if(message==='ADMIN_UNAUTHORIZED'||message==='UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    if(message==='RENTAL_NOT_FOUND')return NextResponse.json({error:'렌탈 계약을 찾을 수 없습니다.'},{status:404});
    if(message==='NOT_RENTAL')return NextResponse.json({error:'렌탈 상담에만 납부일정을 등록할 수 있습니다.'},{status:400});
    console.error('rental payments load error',error);
    return NextResponse.json({error:message||'렌탈 납부내역 조회 오류'},{status:500});
  }
}

export async function POST(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const body=await req.json();
    const {supabase,consultation}=await rentalConsultation(id);

    const start=dateOnly(consultation.rental_start_date);
    const months=Math.trunc(Number(consultation.rental_contract_months||0));
    const paymentDay=Math.trunc(Number(consultation.rental_payment_day||0));
    const amount=Number(consultation.rental_monthly_fee||0);

    if(!start)return NextResponse.json({error:'계약 시작일을 먼저 저장해 주세요.'},{status:400});
    if(!Number.isFinite(months)||months<1||months>120){
      return NextResponse.json({error:'계약기간을 1~120개월로 저장해 주세요.'},{status:400});
    }
    if(!Number.isFinite(paymentDay)||paymentDay<1||paymentDay>31){
      return NextResponse.json({error:'매월 결제일을 1~31일로 저장해 주세요.'},{status:400});
    }
    if(!Number.isFinite(amount)||amount<=0){
      return NextResponse.json({error:'월 렌탈료를 0원보다 크게 저장해 주세요.'},{status:400});
    }

    const rows=Array.from({length:months},(_,index)=>{
      const monthStart=addMonths(firstOfMonth(start),index);
      let dueDate=addMonths(`${monthStart.slice(0,8)}${String(paymentDay).padStart(2,'0')}`,0);
      if(index===0&&dueDate<start)dueDate=start;
      return {
        consultation_id:id,
        billing_month:firstOfMonth(monthStart),
        due_date:dueDate,
        amount,
        status:'납부예정',
        updated_at:new Date().toISOString(),
      };
    });

    const replaceExisting=body.replace_existing===true;
    if(replaceExisting){
      const {error:deleteError}=await supabase
        .from('rental_payments')
        .delete()
        .eq('consultation_id',id)
        .eq('status','납부예정');
      if(deleteError)throw deleteError;
    }

    const {error}=await supabase
      .from('rental_payments')
      .upsert(rows,{
        onConflict:'consultation_id,billing_month',
        ignoreDuplicates:true,
      });
    if(error)throw error;

    const {data,error:loadError}=await supabase
      .from('rental_payments')
      .select('*')
      .eq('consultation_id',id)
      .order('billing_month',{ascending:true});
    if(loadError)throw loadError;

    return NextResponse.json({success:true,data:data||[],generated:rows.length});
  }catch(error:unknown){
    const message=error instanceof Error?error.message:'';
    if(message==='ADMIN_UNAUTHORIZED'||message==='UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    if(message==='RENTAL_NOT_FOUND')return NextResponse.json({error:'렌탈 계약을 찾을 수 없습니다.'},{status:404});
    if(message==='NOT_RENTAL')return NextResponse.json({error:'렌탈 상담에만 납부일정을 등록할 수 있습니다.'},{status:400});
    console.error('rental payments generate error',error);
    return NextResponse.json({error:message||'렌탈 청구일정 생성 오류'},{status:500});
  }
}

