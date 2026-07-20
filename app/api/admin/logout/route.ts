import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {ADMIN_COOKIE_NAME,adminCookieOptions} from '@/lib/adminAuth';

function ip(req:NextRequest){return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||null;}

export async function POST(req:NextRequest){
  try{
    await getSupabaseServer().from('admin_audit_logs').insert({action:'logout',result:'success',ip_address:ip(req),user_agent:req.headers.get('user-agent')});
  }catch{}
  const store=await cookies();
  store.set(ADMIN_COOKIE_NAME,'',{...adminCookieOptions,maxAge:0});
  return NextResponse.json({success:true});
}
