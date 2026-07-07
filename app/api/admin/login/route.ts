import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const adminPassword = process.env.RECHAIR_ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json(
        { error: '관리자 비밀번호 환경변수(RECHAIR_ADMIN_PASSWORD)가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set('rechair_admin_auth', 'ok', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
