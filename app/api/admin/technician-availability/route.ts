import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';

export const dynamic='force-dynamic';

const TYPES=['근무','휴무','교육','연차'];

export async function GET(req:NextRequest){
  try{
    await requireAdmin();
    const url=new URL(req.url);
    const date=String(url.searchParams.get('date')||'').trim();
    const technicianId=String(url.searchParams.get('technician_id')||'').trim();
    const supabase=getSupabaseServer();

    let query=supabase
      .from('technician_availability')
      .select(`
        id,
        technician_id,
        work_date,
        availability_type,
        start_time,
        end_time,
        note,
        updated_at,
        technicians(id,name,region,team_name,is_active)
      `)
      .order('work_date',{ascending:true});

    if(date)query=query.eq('work_date',date);
    if(technicianId)query=query.eq('technician_id',technicianId);

    const {data,error}=await query;
    if(error)throw error;
    return NextResponse.json({data:data||[]});
  }catch(error:any){
    if(error?.message==='ADMIN_UNAUTHORIZED'||error?.message==='UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('technician availability load error',error);
    return NextResponse.json({error:error?.message||'근무 설정 조회 오류'},{status:500});
  }
}

export async function POST(req:NextRequest){
  try{
    await requireAdmin();
    const body=await req.json();
    const technicianId=String(body.technician_id||'').trim();
    const workDate=String(body.work_date||'').trim();
    const availabilityType=String(body.availability_type||'근무').trim();
    const startTime=String(body.start_time||'').trim()||null;
    const endTime=String(body.end_time||'').trim()||null;
    const note=String(body.note||'').trim()||null;

    if(!technicianId||!/^\d{4}-\d{2}-\d{2}$/.test(workDate)){
      return NextResponse.json({error:'기사와 적용 날짜를 선택해 주세요.'},{status:400});
    }
    if(!TYPES.includes(availabilityType)){
      return NextResponse.json({error:'올바른 근무 구분이 아닙니다.'},{status:400});
    }
    if(availabilityType==='근무'&&startTime&&endTime&&startTime>=endTime){
      return NextResponse.json({error:'종료시간은 시작시간보다 늦어야 합니다.'},{status:400});
    }

    const now=new Date().toISOString();
    const supabase=getSupabaseServer();
    const {data,error}=await supabase
      .from('technician_availability')
      .upsert({
        technician_id:technicianId,
        work_date:workDate,
        availability_type:availabilityType,
        start_time:availabilityType==='근무'?startTime:null,
        end_time:availabilityType==='근무'?endTime:null,
        note,
        updated_at:now,
      },{onConflict:'technician_id,work_date'})
      .select('*')
      .single();

    if(error)throw error;
    return NextResponse.json({data},{status:201});
  }catch(error:any){
    if(error?.message==='ADMIN_UNAUTHORIZED'||error?.message==='UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('technician availability save error',error);
    return NextResponse.json({error:error?.message||'근무 설정 저장 오류'},{status:500});
  }
}
