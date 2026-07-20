import {NextRequest,NextResponse} from 'next/server';
import {requireTechnicianSession} from '@/lib/technicianAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

const ALLOWED=['이동중','방문중','작업중','완료'];

const TRANSITIONS:Record<string,string[]>={
  '배정대기':['이동중'],
  '배정완료':['이동중'],
  '이동중':['방문중'],
  '방문중':['작업중'],
  '작업중':['완료'],
  '완료':[],
};

function numberOrNull(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function eventType(status:string){
  return {
    '이동중':'departure',
    '방문중':'arrival',
    '작업중':'work_start',
    '완료':'complete',
  }[status]||null;
}

export async function PATCH(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const body=await req.json();

    if(!ALLOWED.includes(body.status)){
      return NextResponse.json({error:'허용되지 않은 상태입니다.'},{status:400});
    }

    const supabase=getSupabaseServer();

    const {data:current,error:currentError}=await supabase
      .from('service_schedules')
      .select('*')
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .single();

    if(currentError||!current){
      return NextResponse.json({
        error:'본인에게 배정된 일정만 수정할 수 있습니다.'
      },{status:403});
    }

    const allowedNext=TRANSITIONS[current.status]||[];

    if(!allowedNext.includes(body.status)){
      return NextResponse.json({
        error:`현재 '${current.status}' 상태에서는 '${body.status}' 처리할 수 없습니다.`
      },{status:409});
    }

    const now=new Date().toISOString();
    const latitude=numberOrNull(body.latitude);
    const longitude=numberOrNull(body.longitude);
    const accuracy=numberOrNull(body.accuracy);

    const payload:any={
      status:body.status,
      updated_at:now,
    };

    if(body.status==='이동중'){
      payload.departed_at=now;
      payload.departure_lat=latitude;
      payload.departure_lng=longitude;
    }

    if(body.status==='방문중'){
      payload.arrival_at=now;
      payload.arrival_lat=latitude;
      payload.arrival_lng=longitude;
    }

    if(body.status==='작업중'){
      payload.started_at=now;
      payload.work_started_at=now;
      payload.work_start_lat=latitude;
      payload.work_start_lng=longitude;
    }

    if(body.status==='완료'){
      payload.completed_at=now;
      payload.completion_lat=latitude;
      payload.completion_lng=longitude;
      payload.completion_note=body.completion_note||null;
      payload.completion_photo_urls=Array.isArray(body.completion_photo_urls)
        ? body.completion_photo_urls
        : [];
    }

    const {data,error}=await supabase
      .from('service_schedules')
      .update(payload)
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .select('*')
      .single();

    if(error)throw error;

    const type=eventType(body.status);

    if(type){
      const {error:eventError}=await supabase
        .from('technician_visit_events')
        .insert({
          schedule_id:id,
          technician_id:session.technician_id,
          technician_name:session.technician.name,
          event_type:type,
          latitude,
          longitude,
          accuracy_meters:accuracy,
        });

      if(eventError)throw eventError;
    }

    if(data?.consultation_id){
      const consultationPayload:any={updated_at:now};

      if(body.status==='방문중'){
        consultationPayload.status='방문완료';
      }

      if(body.status==='작업중'){
        consultationPayload.status='상담중';
      }

      if(body.status==='완료'){
        consultationPayload.status='종료';
        consultationPayload.memo=[
          data.memo,
          body.completion_note,
        ].filter(Boolean).join('\n');
      }

      await supabase
        .from('consultations')
        .update(consultationPayload)
        .eq('id',data.consultation_id);
    }

    return NextResponse.json({data});
  }catch(e:any){
    if(e?.message==='TECHNICIAN_UNAUTHORIZED'){
      return NextResponse.json({error:'로그인이 필요합니다.'},{status:401});
    }

    return NextResponse.json({
      error:e?.message||'현장 상태 저장 오류'
    },{status:500});
  }
}
