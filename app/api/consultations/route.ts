import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ConsultationPayload = {
  name: string;
  phone: string;
  service: string;
  model: string;
  message: string;
  photos: string[];
  status?: string;
  manager?: string;
  memo?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function supabaseRequest(path: string, init?: RequestInit) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Supabase request failed');
  }

  return res.json();
}

export async function GET() {
  try {
    const data = await supabaseRequest('consultations?select=*&order=created_at.desc');
    if (data) return NextResponse.json({ ok: true, consultations: data });

    return NextResponse.json({
      ok: true,
      mock: true,
      consultations: [
        {
          id: 'demo-001',
          created_at: new Date().toISOString(),
          name: '홍길동',
          phone: '010-0000-0000',
          service: '중고 안마의자 판매',
          model: '코지마 CMC-A100',
          message: '제품 매입 상담을 원합니다.',
          photos: ['front:demo-front.jpg', 'side:demo-side.jpg', 'label:demo-label.jpg', 'back:demo-back.jpg'],
          status: '신규',
          manager: '',
          memo: ''
        }
      ]
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const uploadedPhotos: string[] = [];
    const photoFields = ['frontPhoto', 'sidePhoto', 'labelPhoto', 'backPhoto'];

    Array.from(formData.entries()).forEach(([key, value]) => {
      if (photoFields.includes(key) && value instanceof File && value.size > 0) {
        uploadedPhotos.push(`${key}:${value.name}`);
      }
    });

    const payload: ConsultationPayload = {
      name: String(formData.get('name') || ''),
      phone: String(formData.get('phone') || ''),
      service: String(formData.get('service') || ''),
      model: String(formData.get('model') || ''),
      message: String(formData.get('message') || ''),
      photos: uploadedPhotos,
      status: '신규',
      manager: '',
      memo: ''
    };

    const data = await supabaseRequest('consultations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return NextResponse.json({ ok: true, saved: Boolean(data), data: data?.[0] || payload });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
