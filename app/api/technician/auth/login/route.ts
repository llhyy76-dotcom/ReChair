import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  createSessionToken,
  hashSessionToken,
  technicianCookie,
} from '@/lib/technicianAuth';

export async function POST(req:NextRequest){
  try{
    const body=await req.json();

    const name=String(
      body.name||
      body.technician_name||
      body.assignee||
      ''
    ).trim();

    const pin=String(body.pin||'').trim();

    if(!name||!pin){
      return NextResponse.json(
        {error:'기사·팀 이름과 PIN을 입력하세요.'},
        {status:400}
      );
    }

    const supabase=getSupabaseServer();

    const {data:verified,error:verifyError}=await supabase
      .rpc('verify_technician_pin',{
        p_name:name,
        p_pin:pin,
      });

    if(verifyError){
      throw verifyError;
    }

    const technician=Array.isArray(verified)
      ? verified[0]
      : verified;

    if(!technician){
      return NextResponse.json(
        {error:'기사명 또는 PIN이 올바르지 않습니다.'},
        {status:401}
      );
    }

    const technicianId=
      technician.technician_id ??
      technician.id ??
      null;

    if(!technicianId){
      console.error('기사 ID 누락:',technician);

      return NextResponse.json(
        {error:'기사 ID를 확인할 수 없습니다. PIN 검증 함수를 확인해주세요.'},
        {status:500}
      );
    }

    const technicianName=
      technician.technician_name ??
      technician.name ??
      name;

    const rawToken=createSessionToken();
    const tokenHash=hashSessionToken(rawToken);

    const expiresAt=new Date(
      Date.now()+technicianCookie.options.maxAge*1000
    ).toISOString();

    const {error:deleteError}=await supabase
      .from('technician_sessions')
      .delete()
      .eq('technician_id',technicianId);

    if(deleteError){
      throw deleteError;
    }

    const {error:sessionError}=await supabase
      .from('technician_sessions')
      .insert({
        technician_id:technicianId,
        token_hash:tokenHash,
        expires_at:expiresAt,
      });

    if(sessionError){
      throw sessionError;
    }

    const response=NextResponse.json({
      success:true,
      data:{
        id:technicianId,
        name:technicianName,
        phone:technician.phone??null,
        region:technician.region??null,
        team_name:technician.team_name??null,
        expires_at:expiresAt,
      },
    });

    response.cookies.set(
      technicianCookie.name,
      rawToken,
      technicianCookie.options
    );

    return response;
  }catch(e:any){
    console.error('technician login error',e);

    return NextResponse.json(
      {
        error:e?.message||
          '기사 로그인 처리 중 오류가 발생했습니다.',
      },
      {status:500}
    );
  }
}
