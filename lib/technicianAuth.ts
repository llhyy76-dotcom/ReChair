import crypto from 'node:crypto';
import {cookies} from 'next/headers';
import {getSupabaseServer} from '@/lib/supabaseServer';

const COOKIE_NAME='rechair_technician_session';

export function hashSessionToken(token:string){
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(){
  return crypto.randomBytes(32).toString('hex');
}

export async function getTechnicianSession(){
  const cookieStore=await cookies();
  const token=cookieStore.get(COOKIE_NAME)?.value;

  if(!token)return null;

  const tokenHash=hashSessionToken(token);
  const supabase=getSupabaseServer();

  const {data,error}=await supabase
    .from('technician_sessions')
    .select(`
      id,
      expires_at,
      technician_id,
      technicians (
        id,
        name,
        phone,
        region,
        team_name,
        is_active
      )
    `)
    .eq('token_hash',tokenHash)
    .gt('expires_at',new Date().toISOString())
    .maybeSingle();

  if(error||!data)return null;

  const technician=Array.isArray(data.technicians)
    ? data.technicians[0]
    : data.technicians;

  if(!technician?.is_active)return null;

  return {
    session_id:data.id,
    technician_id:data.technician_id,
    technician,
  };
}

export async function requireTechnicianSession(){
  const session=await getTechnicianSession();
  if(!session){
    throw new Error('TECHNICIAN_UNAUTHORIZED');
  }
  return session;
}

export const technicianCookie={
  name:COOKIE_NAME,
  options:{
    httpOnly:true,
    sameSite:'lax' as const,
    secure:process.env.NODE_ENV==='production',
    path:'/',
    maxAge:60*60*12,
  }
};
