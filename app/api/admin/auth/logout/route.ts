import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {ADMIN_COOKIE_NAME,adminCookieOptions} from '@/lib/adminAuth';
export async function POST(){
  const store=await cookies();
  store.set(ADMIN_COOKIE_NAME,'',{...adminCookieOptions,maxAge:0});
  return NextResponse.json({success:true});
}
