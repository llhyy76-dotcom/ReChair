
import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  TECHNICIAN_COOKIE_NAME,
  technicianCookieOptions,
  createTechnicianToken,
} from '@/lib/technicianAuth';

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const name=String(body.name||body.technician_name||'').trim();
    const pin=String(body.pin||'').trim();

    if(!name||!pin){
      return NextResponse.json(
        {error:'기사명과 PIN을 입력하세요.'},
        {status:400}
      );
    }

    const supabase=getSupabaseServer();

    const {data:technician,error}=await supabase
      .from('technicians')
      .select('id,name,team,region,is_active,pin_hash')
      .eq('name',name)
      .eq('is_active',true)
      .single();

    if(error||!technician){
      return NextResponse.json(
        {error:'기사 정보를 찾을 수 없습니다.'},
        {status:401}
      );
    }

    const {data:pinMatched,error:pinError}=await supabase.rpc(
      'verify_technician_pin',
      {
        p_technician_id:technician.id,
        p_pin:pin,
      }
    );

    if(pinError){
      throw pinError;
    }

    if(!pinMatched){
      return NextResponse.json(
        {error:'PIN이 올바르지 않습니다.'},
        {status:401}
      );
    }

    const token=createTechnicianToken({
      technician_id:technician.id,
      name:technician.name,
      team:technician.team,
      region:technician.region,
    });

    const store=await cookies();
    store.set(
      TECHNICIAN_COOKIE_NAME,
      token,
      technicianCookieOptions
    );

    return NextResponse.json({
      success:true,
      data:{
        id:technician.id,
        name:technician.name,
        team:technician.team,
        region:technician.region,
      },
    });
  }catch(e:any){
    return NextResponse.json(
      {error:e?.message||'기사 로그인 오류'},
      {status:500}
    );
  }
}
