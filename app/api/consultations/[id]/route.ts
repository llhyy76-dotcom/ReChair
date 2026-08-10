import { NextResponse } from 'next/server';

// Consultation changes are available only through /api/admin/consultations/[id].
export async function PATCH() {
  return NextResponse.json(
    { error: '허용되지 않은 요청입니다.' },
    { status: 405 }
  );
}

