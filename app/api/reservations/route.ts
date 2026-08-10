import { NextResponse } from 'next/server';

// Legacy reservation API is disabled. The consent-aware /api/consultations
// endpoint is the single customer inquiry entry point.
export async function GET() {
  return NextResponse.json(
    { error: '허용되지 않은 요청입니다.' },
    { status: 405 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: '새 상담 신청 화면을 이용해 주세요.' },
    { status: 410 }
  );
}

