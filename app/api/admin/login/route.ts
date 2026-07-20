import crypto from 'node:crypto';
import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {ADMIN_COOKIE_NAME,adminCookieOptions,createAdminToken} from '@/lib/adminAuth';

function safeEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function ip(req:NextRequest){return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||null;}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const input=String(body.password||'');
    const expected=process.env.RECHAIR_ADMIN_PASSWORD;
    if(!expected)return NextResponse.json({error:'RECHAIR_ADMIN_PASSWORD 환경변수가 없습니다.'},{status:500});
    if(!safeEqual(input,expected)){
      await getSupabaseServer().from('admin_audit_logs').insert({action:'login',result:'fail',ip_address:ip(req),user_agent:req.headers.get('user-agent')});
      return NextResponse.json({error:'비밀번호가 올바르지 않습니다.'},{status:401});
    }
    const store=await cookies();
    store.set(ADMIN_COOKIE_NAME,createAdminToken(),adminCookieOptions);
    await getSupabaseServer().from('admin_audit_logs').insert({action:'login',result:'success',ip_address:ip(req),user_agent:req.headers.get('user-agent')});
    return NextResponse.json({success:true});
  }catch(e:any){return NextResponse.json({error:e?.message||'관리자 로그인 오류'},{status:500});}
}
