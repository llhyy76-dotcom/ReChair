import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const payload: Record<string, unknown> = {};

    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        payload[key] = {
          filename: value.name,
          size: value.size,
          type: value.type
        };
      } else {
        payload[key] = value;
      }
    }

    console.log('consultation received', payload);
    return NextResponse.json({ ok: true, message: 'received', data: payload });
  }

  const body = await req.json();
  console.log('consultation received', body);
  return NextResponse.json({ ok: true, message: 'received' });
}

export async function GET() {
  return NextResponse.json({ items: [] });
}
