import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const photoFields = ['frontPhoto', 'sidePhoto', 'labelPhoto', 'backPhoto'];
    const uploadedPhotos: string[] = [];
    const payload: Record<string, string> = {};

    for (const [key, value] of Array.from(formData.entries())) {
      if (photoFields.includes(key) && value instanceof File && value.size > 0) {
        // 현재 단계에서는 빌드 안정화를 위해 파일명을 저장합니다.
        // Supabase Storage 연동 단계에서 실제 업로드 URL 저장으로 교체합니다.
        uploadedPhotos.push(`${key}:${value.name}`);
      } else if (!(value instanceof File)) {
        payload[key] = String(value);
      }
    }

    return NextResponse.json({
      ok: true,
      message: '상담 신청이 접수되었습니다.',
      data: {
        ...payload,
        photos: uploadedPhotos,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('consultation error', error);
    return NextResponse.json(
      { ok: false, message: '상담 접수 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    consultations: [],
  });
}
