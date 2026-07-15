import {NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {
  createSessionToken,
  hashSessionToken,
  technicianCookie,
} from '@/lib/technicianAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const name=String(body.name||'').trim();
    const pin=String(body.pin||'').trim();

    if(!name||pin.length<4){
      return NextResponse.json({error:'기사명과 4자리 이상의 PIN이 필요합니다.'},{status:400});
    }

    const supabase=getSupabaseServer();

    const {data:verified,error:verifyError}=await supabase
      .rpc('verify_technician_pin',{
        p_name:name,
        p_pin:pin,
      });

    if(verifyError)throw verifyError;

    const technician=Array.isArray(verified)?verified[0]:verified;

    if(!technician?.id){
      return NextResponse.json({error:'기사명 또는 PIN이 올바르지 않습니다.'},{status:401});
    }

    const token=createSessionToken();
    const tokenHash=hashSessionToken(token);
    const expiresAt=new Date(Date.now()+12*60*60*1000).toISOString();

    const {error:sessionError}=await supabase
      .from('technician_sessions')
      .insert({
        technician_id:technician.id,
        token_hash:tokenHash,
        expires_at:expiresAt,
        user_agent:req.headers.get('user-agent'),
      });

    if(sessionError)throw sessionError;

    const cookieStore=await cookies();
    cookieStore.set(technicianCookie.name,token,technicianCookie.options);

    return NextResponse.json({
      data:{
        id:technician.id,
        name:technician.name,
        expires_at:expiresAt,
      }
    });
  }catch(e:any){
    return NextResponse.json({error:e?.message||'기사 로그인 오류'},{status:500});
  }
}
