import crypto from 'node:crypto';
import {cookies} from 'next/headers';

export const ADMIN_COOKIE_NAME='rechair_admin_session';

function secret(){
  const value=process.env.ADMIN_SESSION_SECRET;
  if(!value) throw new Error('ADMIN_SESSION_SECRET 환경변수가 설정되지 않았습니다.');
  return value;
}
function sign(payload:string){
  return crypto.createHmac('sha256',secret()).update(payload).digest('base64url');
}
export function createAdminToken(){
  const payload=Buffer.from(JSON.stringify({role:'admin',exp:Date.now()+12*60*60*1000})).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifyAdminToken(token?:string|null){
  try{
    if(!token) return false;
    const [payload,signature]=token.split('.');
    if(!payload||!signature) return false;
    const expected=sign(payload);
    const a=Buffer.from(signature), b=Buffer.from(expected);
    if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return false;
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return parsed?.role==='admin' && Number(parsed?.exp)>Date.now();
  }catch{return false;}
}
export async function requireAdmin(){
  const store=await cookies();
  if(!verifyAdminToken(store.get(ADMIN_COOKIE_NAME)?.value)) throw new Error('ADMIN_UNAUTHORIZED');
}
export const adminCookieOptions={
  httpOnly:true,
  sameSite:'lax' as const,
  secure:process.env.NODE_ENV==='production',
  path:'/',
  maxAge:60*60*12,
};
export async function requireAdminSession(){
  const valid=await verifyAdminSession();

  if(!valid){
    throw new Error('ADMIN_UNAUTHORIZED');
  }

  return true;
}
