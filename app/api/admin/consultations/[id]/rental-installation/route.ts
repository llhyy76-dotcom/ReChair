import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';
import {availabilityCheck,kstDayRange,overlaps} from '@/lib/dispatchRecommendation';
import {recordRentalAssetEvent,syncRentalProductFromAssets} from '@/lib/rentalAsset';

export const dynamic='force-dynamic';

const LOCKED_STATUSES=['이동중','방문중','작업중','완료'];

function unauthorized(error:unknown){
  return error instanceof Error&&(
    error.message==='ADMIN_UNAUTHORIZED'||error.message==='UNAUTHORIZED'
  );
}

function installationMemo(consultation:any,extra:unknown){
  return [
    `[렌탈 설치] ${consultation.product_title||[consultation.brand,consultation.model_name].filter(Boolean).join(' ')||consultation.service_type}`,
    consultation.rental_contract_no?`계약번호: ${consultation.rental_contract_no}`:null,
    consultation.rental_terms_memo?`계약 메모: ${consultation.rental_terms_memo}`:null,
    String(extra||'').trim()||null,
  ].filter(Boolean).join('\n');
}

async function validateTechnician({
  supabase,
  assignee,
  requestedStart,
  durationMinutes,
  excludeScheduleId,
}:{
  supabase:ReturnType<typeof getSupabaseServer>;
  assignee:string;
  requestedStart:Date;
  durationMinutes:number;
  excludeScheduleId?:string|null;
}){
  const {data:technician,error:technicianError}=await supabase
    .from('technicians')
    .select('id,name,is_active,daily_capacity')
    .eq('name',assignee)
    .single();

  if(technicianError||!technician||!technician.is_active){
    throw new Error('ACTIVE_TECHNICIAN_REQUIRED');
  }

  const dateText=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(requestedStart);
  const {start,end}=kstDayRange(dateText);

  const {data:availability,error:availabilityError}=await supabase
    .from('technician_availability')
    .select('technician_id,availability_type,start_time,end_time,note')
    .eq('technician_id',technician.id)
    .eq('work_date',dateText)
    .maybeSingle();
  if(availabilityError)throw availabilityError;

  const available=availabilityCheck({
    technician,availability,requestedStart,requestedDuration:durationMinutes,
  });
  if(!available.available){
    throw new Error(`TECHNICIAN_UNAVAILABLE:${available.reason}`);
  }

  let scheduleQuery=supabase
    .from('service_schedules')
    .select('id,assignee,scheduled_at,duration_minutes,status')
    .eq('assignee',assignee)
    .gte('scheduled_at',start)
    .lt('scheduled_at',end)
    .neq('status','취소');
  if(excludeScheduleId)scheduleQuery=scheduleQuery.neq('id',excludeScheduleId);

  const {data:existing,error:existingError}=await scheduleQuery;
  if(existingError)throw existingError;

  const conflict=(existing||[]).find(schedule=>
    overlaps(schedule,requestedStart,durationMinutes)
  );
  if(conflict)throw new Error(`SCHEDULE_CONFLICT:${conflict.id}`);

  const capacity=Math.max(1,Number(technician.daily_capacity||5));
  if((existing||[]).length>=capacity)throw new Error('TECHNICIAN_CAPACITY');
}

export async function GET(
  _req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const supabase=getSupabaseServer();
    const {data:consultation,error:consultationError}=await supabase
      .from('consultations')
      .select('id,service_type')
      .eq('id',id)
      .single();

    if(consultationError||!consultation){
      return NextResponse.json({error:'렌탈 상담을 찾을 수 없습니다.'},{status:404});
    }
    if(!String(consultation.service_type||'').includes('렌탈')){
      return NextResponse.json({error:'렌탈 상담에만 설치 일정을 연결할 수 있습니다.'},{status:400});
    }

    const {data,error}=await supabase
      .from('service_schedules')
      .select('*')
      .eq('consultation_id',id)
      .eq('schedule_kind','rental_installation')
      .neq('status','취소')
      .maybeSingle();
    if(error)throw error;
    return NextResponse.json({data:data||null});
  }catch(error:unknown){
    if(unauthorized(error)){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('rental installation load error',error);
    return NextResponse.json({error:error instanceof Error?error.message:'렌탈 설치 일정 조회 오류'},{status:500});
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
    const supabase=getSupabaseServer();
    const {data:consultation,error:consultationError}=await supabase
      .from('consultations')
      .select('*')
      .eq('id',id)
      .single();

    if(consultationError||!consultation){
      return NextResponse.json({error:'렌탈 상담을 찾을 수 없습니다.'},{status:404});
    }
    if(!String(consultation.service_type||'').includes('렌탈')){
      return NextResponse.json({error:'렌탈 상담에만 설치 일정을 연결할 수 있습니다.'},{status:400});
    }
    if(!consultation.rental_contract_id||!consultation.rental_contract_signed_at){
      return NextResponse.json({error:'고객 전자서명이 완료된 렌탈 계약서가 있어야 설치 일정을 생성할 수 있습니다.'},{status:409});
    }
    const {data:signedContract,error:signedContractError}=await supabase
      .from('rental_contracts')
      .select('id,status,signed_at')
      .eq('id',consultation.rental_contract_id)
      .eq('consultation_id',id)
      .maybeSingle();
    if(
      signedContractError||
      !signedContract||
      !['signed','superseded'].includes(String(signedContract.status))||
      !signedContract.signed_at
    ){
      return NextResponse.json({error:'유효한 전자서명 계약서를 확인할 수 없습니다.'},{status:409});
    }
    if(!['계약완료','설치예약'].includes(String(consultation.rental_stage||''))){
      return NextResponse.json({error:'렌탈 단계를 먼저 계약완료로 저장해 주세요.'},{status:409});
    }

    let managedAsset:any=null;
    if(consultation.product_id){
      const {data:product,error:productError}=await supabase
        .from('products')
        .select('id,rental_asset_managed')
        .eq('id',consultation.product_id)
        .maybeSingle();
      if(productError)throw productError;
      if(product?.rental_asset_managed){
        if(!consultation.rental_asset_id){
          return NextResponse.json({
            error:'설치 일정을 만들기 전에 계약에 실제 안마의자 자산을 배정해 주세요.',
          },{status:409});
        }
        const {data:asset,error:assetError}=await supabase
          .from('rental_assets')
          .select('*')
          .eq('id',consultation.rental_asset_id)
          .eq('product_id',consultation.product_id)
          .eq('current_consultation_id',id)
          .maybeSingle();
        if(assetError)throw assetError;
        if(!asset||!['배정완료','설치예약'].includes(String(asset.status))){
          return NextResponse.json({
            error:'배정된 자산을 확인할 수 없거나 설치 가능한 상태가 아닙니다.',
          },{status:409});
        }
        managedAsset=asset;
      }
    }

    const requestedStart=new Date(body.scheduled_at||consultation.rental_installation_at||'');
    if(Number.isNaN(requestedStart.getTime())){
      return NextResponse.json({error:'설치 예정일을 입력해 주세요.'},{status:400});
    }
    const assignee=String(body.assignee||consultation.assignee||'').trim();
    if(!assignee){
      return NextResponse.json({error:'설치 담당기사를 선택해 주세요.'},{status:400});
    }
    const region=String(body.region||consultation.region||'').trim();
    const address=String(body.address||consultation.address||'').trim();
    if(!region||!address){
      return NextResponse.json({error:'설치 지역과 주소를 먼저 저장해 주세요.'},{status:400});
    }
    const requestedDuration=Number(body.duration_minutes||120);
    if(!Number.isFinite(requestedDuration)){
      return NextResponse.json({error:'예상 설치시간을 숫자로 입력해 주세요.'},{status:400});
    }
    const durationMinutes=Math.max(30,Math.min(480,requestedDuration));

    const {data:existing,error:existingError}=await supabase
      .from('service_schedules')
      .select('*')
      .eq('consultation_id',id)
      .eq('schedule_kind','rental_installation')
      .neq('status','취소')
      .maybeSingle();
    if(existingError)throw existingError;

    if(existing&&LOCKED_STATUSES.includes(existing.status)){
      return NextResponse.json({
        error:`현재 설치 일정이 '${existing.status}' 상태라 변경할 수 없습니다. 현장 작업보고에서 진행해 주세요.`,
      },{status:409});
    }

    await validateTechnician({
      supabase,assignee,requestedStart,durationMinutes,excludeScheduleId:existing?.id,
    });

    const now=new Date().toISOString();
    const payload={
      consultation_id:id,
      schedule_kind:'rental_installation',
      customer_name:consultation.customer_name??consultation.name??'이름 없음',
      phone:consultation.phone??null,
      region,
      address,
      service_type:consultation.service_type||'안마의자 렌탈 설치',
      assignee,
      scheduled_at:requestedStart.toISOString(),
      duration_minutes:durationMinutes,
      status:'배정완료',
      memo:installationMemo(consultation,body.memo),
      rental_asset_id:managedAsset?.id||null,
      updated_at:now,
    };

    const scheduleQuery=existing
      ?supabase.from('service_schedules').update(payload).eq('id',existing.id)
      :supabase.from('service_schedules').insert(payload);
    const {data:schedule,error:scheduleError}=await scheduleQuery.select('*').single();
    if(scheduleError)throw scheduleError;

    const {error:updateError}=await supabase
      .from('consultations')
      .update({
        region,address,assignee,
        rental_installation_at:requestedStart.toISOString(),
        rental_stage:'설치예약',
        rental_stage_updated_at:now,
        next_action_at:requestedStart.toISOString(),
        status:'예약완료',
        updated_at:now,
      })
      .eq('id',id);
    if(updateError)throw updateError;

    if(managedAsset){
      const previousStatus=String(managedAsset.status);
      const {error:assetError}=await supabase.from('rental_assets').update({
        status:'설치예약',
        location_type:'창고',
        updated_at:now,
      }).eq('id',managedAsset.id);
      if(assetError)throw assetError;
      if(previousStatus!=='설치예약'){
        await recordRentalAssetEvent({
          supabase,assetId:managedAsset.id,consultationId:id,scheduleId:schedule.id,
          eventType:'installation_scheduled',fromStatus:previousStatus,toStatus:'설치예약',
          actorType:'admin',detail:{scheduled_at:requestedStart.toISOString(),assignee},
        });
      }
      await syncRentalProductFromAssets(supabase,managedAsset.product_id);
    }

    return NextResponse.json({data:schedule,created:!existing},{status:existing?200:201});
  }catch(error:unknown){
    if(unauthorized(error)){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    const message=error instanceof Error?error.message:'';
    if(message==='ACTIVE_TECHNICIAN_REQUIRED'){
      return NextResponse.json({error:'활성 상태의 기사에게만 배정할 수 있습니다.'},{status:400});
    }
    if(message.startsWith('TECHNICIAN_UNAVAILABLE:')){
      return NextResponse.json({error:`선택한 기사는 배정할 수 없습니다. ${message.split(':').slice(1).join(':')}`},{status:409});
    }
    if(message.startsWith('SCHEDULE_CONFLICT:')){
      return NextResponse.json({error:'선택한 기사에게 같은 시간대의 일정이 있습니다.'},{status:409});
    }
    if(message==='TECHNICIAN_CAPACITY'){
      return NextResponse.json({error:'선택한 기사의 일일 처리한도를 초과합니다.'},{status:409});
    }
    console.error('rental installation save error',error);
    return NextResponse.json({error:message||'렌탈 설치 일정 저장 오류'},{status:500});
  }
}
