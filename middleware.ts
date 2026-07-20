import {NextRequest,NextResponse} from 'next/server';

const COOKIE='rechair_admin_session';

async function valid(token?:string){
  try{
    if(!token||!process.env.ADMIN_SESSION_SECRET) return false;
    const [payload,signature]=token.split('.');
    if(!payload||!signature) return false;
    const key=await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET),
      {name:'HMAC',hash:'SHA-256'},
      false,
      ['sign']
    );
    const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload));
    const expected=btoa(String.fromCharCode(...new Uint8Array(signed)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if(expected!==signature) return false;
    const parsed=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    return parsed?.role==='admin'&&Number(parsed?.exp)>Date.now();
  }catch{return false;}
}

export async function middleware(req:NextRequest){
  const path=req.nextUrl.pathname;
  if(path==='/admin/login'||path==='/api/admin/auth/login'||path==='/api/admin/auth/logout'){
    return NextResponse.next();
  }
  if(await valid(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if(path.startsWith('/api/admin/')) return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
  const url=new URL('/admin/login',req.url);
  url.searchParams.set('next',path+req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config={matcher:['/admin/:path*','/api/admin/:path*']};
