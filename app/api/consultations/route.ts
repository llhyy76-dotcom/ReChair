import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type PhotoSlot = 'front' | 'side' | 'label' | 'back';

async function uploadPhoto(
  supabase: ReturnType<typeof getSupabaseClient>,
  file: File,
  slot: PhotoSlot
) {
  const ext = file.name.split('.').pop() || 'jpg';
  const safeName = `${Date.now()}-${slot}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `consultations/${safeName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from('consultation-photos')
    .upload(path, arrayBuffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from('consultation-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ data: [], message: 'Supabase is not configured.' });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
    }

    const formData = await request.formData();
    const supabase = getSupabaseClient();

    const getText = (key: string) => String(formData.get(key) ?? '').trim();

    const files: Record<PhotoSlot, File | null> = {
      front: formData.get('photo_front') as File | null,
      side: formData.get('photo_side') as File | null,
      label: formData.get('photo_label') as File | null,
      back: formData.get('photo_back') as File | null,
    };

    const urls: Record<PhotoSlot, string | null> = {
      front: null,
      side: null,
      label: null,
      back: null,
    };

    for (const slot of Object.keys(files) as PhotoSlot[]) {
      const file = files[slot];
      if (file && file.size > 0) {
        urls[slot] = await uploadPhoto(supabase, file, slot);
      }
    }

    // Supabase consultations table column names confirmed in Table Editor:
    // name, phone, service_type, model, message, status, manager, memo,
    // quote_amount, photo_front, photo_side, photo_label, photo_back, extra_photos, timeline
    const payload = {
      name: getText('customer_name') || getText('name') || '이름 미입력',
      phone: getText('phone') || '연락처 미입력',
      service_type: getText('service_type') || getText('service') || '상담',
      model: getText('model_name') || getText('model'),
      message: getText('message'),
      status: '신규',
      manager: '',
      memo: '',
      quote_amount: null,
      photo_front: urls.front,
      photo_side: urls.side,
      photo_label: urls.label,
      photo_back: urls.back,
      extra_photos: [],
      timeline: [
        {
          type: 'created',
          label: '상담 접수',
          at: new Date().toISOString(),
        },
      ],
    };

    const { data, error } = await supabase
      .from('consultations')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
