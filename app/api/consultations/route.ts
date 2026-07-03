import { NextResponse } from 'next/server';

const photoFields = ['frontPhoto', 'sidePhoto', 'labelPhoto', 'backPhoto'];

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const payload: Record<string, FormDataEntryValue | string[]> = {};
    const uploadedPhotos: string[] = [];

    for (const [key, value] of formData.entries()) {
      if (photoFields.includes(key) && value instanceof File && value.size > 0) {
        uploadedPhotos.push(`${key}:${value.name}`);
      } else if (!(value instanceof File)) {
        payload[key] = value;
      }
    }

    payload.photos = uploadedPhotos;

    console.log('consultation received', payload);
    return NextResponse.json({ ok: true, message: 'received', data: payload });
  }

  const body = await req.json().catch(() => ({}));
  console.log('consultation received', body);
  return NextResponse.json({ ok: true, message: 'received', data: body });
}

export async function GET() {
  return NextResponse.json({ items: [] });
}
