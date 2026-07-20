import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {ADMIN_COOKIE_NAME,verifyAdminToken} from '@/lib/adminAuth';

export async function GET(){
  const store=await cookies();
  const token=store.get(ADMIN_COOKIE_NAME)?.value;
  if(!verifyAdminToken(token)) return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
  const [payload]=token!.split('.');
  const parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  return NextResponse.json({data:{role:parsed.role,expires_at:new Date(Number(parsed.exp)).toISOString()}});
}
