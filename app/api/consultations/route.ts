import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type PhotoSlot = 'front' | 'side' | 'label' | 'back';

async function uploadPhoto(supabase: ReturnType<typeof getSupabaseClient>, file: File, slot: PhotoSlot) {
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

  const payload = {
    customer_name: getText('customer_name') || getText('name'),
    phone: getText('phone'),
    region: getText('region'),
    service_type: getText('service_type') || getText('service'),
    brand: getText('brand'),
    model_name: getText('model_name') || getText('model'),
    message: getText('message'),
    status: '신규',
    assignee: '',
    memo: '',
    estimate_amount: null,
    photo_front_url: urls.front,
    photo_side_url: urls.side,
    photo_label_url: urls.label,
    photo_back_url: urls.back,
  };

  const { data, error } = await supabase.from('consultations').insert(payload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
