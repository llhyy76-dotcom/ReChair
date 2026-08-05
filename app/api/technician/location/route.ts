import {NextRequest,NextResponse} from 'next/server';
import {requireTechnicianSession} from '@/lib/technicianAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

function finite(value:unknown){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

export async function PATCH(req:NextRequest){
  try{
    const session=await requireTechnicianSession();
    const body=await req.json();
    const latitude=finite(body.latitude);
    const longitude=finite(body.longitude);

    if(latitude===null||longitude===null||Math.abs(latitude)>90||Math.abs(longitude)>180){
      return NextResponse.json({error:'올바른 위치정보가 필요합니다.'},{status:400});
    }

    const now=new Date().toISOString();
    const payload={
      technician_id:session.technician_id,
      technician_name:session.technician.name,
      latitude,
      longitude,
      accuracy_meters:finite(body.accuracy),
      heading:finite(body.heading),
      speed_mps:finite(body.speed),
      sharing_enabled:true,
      captured_at:body.captured_at||now,
      updated_at:now,
    };

    const {data,error}=await getSupabaseServer()
      .from('technician_live_locations')
      .upsert(payload,{onConflict:'technician_id'})
      .select('*')
      .single();

    if(error)throw error;
    return NextResponse.json({data});
  }catch(error:any){
    if(error?.message==='TECHNICIAN_UNAUTHORIZED'){
      return NextResponse.json({error:'로그인이 필요합니다.'},{status:401});
    }
    return NextResponse.json({error:error?.message||'위치 저장 오류'},{status:500});
  }
}

export async function DELETE(){
  try{
    const session=await requireTechnicianSession();
    const {error}=await getSupabaseServer()
      .from('technician_live_locations')
      .update({sharing_enabled:false,updated_at:new Date().toISOString()})
      .eq('technician_id',session.technician_id);
    if(error)throw error;
    return NextResponse.json({success:true});
  }catch(error:any){
    if(error?.message==='TECHNICIAN_UNAUTHORIZED'){
      return NextResponse.json({error:'로그인이 필요합니다.'},{status:401});
    }
    return NextResponse.json({error:error?.message||'위치 공유 종료 오류'},{status:500});
  }
}
