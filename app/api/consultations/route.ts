import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

async function uploadPhoto(
  supabase: ReturnType<typeof getSupabaseServer>,
  file: File | null,
  prefix: string
) {
  if (!file || file.size === 0) return null;

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `consultations/${Date.now()}-${prefix}-${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('consultation-photos')
    .upload(path, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  return supabase.storage.from('consultation-photos').getPublicUrl(path).data.publicUrl;
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '상담 조회 오류' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const form = await request.formData();

    const [photoFrontUrl, photoSideUrl, photoLabelUrl, photoBackUrl] = await Promise.all([
      uploadPhoto(supabase, form.get('photo_front') as File | null, 'front'),
      uploadPhoto(supabase, form.get('photo_side') as File | null, 'side'),
      uploadPhoto(supabase, form.get('photo_label') as File | null, 'label'),
      uploadPhoto(supabase, form.get('photo_back') as File | null, 'back'),
    ]);

    const customerName = String(form.get('customer_name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const address = String(form.get('address') || '').trim();
    const region = String(form.get('region') || '').trim();
    const serviceType = String(form.get('service_type') || '').trim();
    const brand = String(form.get('brand') || '').trim();
    const modelName = String(form.get('model_name') || '').trim();

    if (!customerName || !phone || !address || !region || !serviceType) {
      return NextResponse.json(
        { error: '이름, 연락처, 방문 주소, 지역, 서비스는 필수입니다.' },
        { status: 400 }
      );
    }

    const payload = {
      // canonical fields
      customer_name: customerName,
      phone,
      address,
      region,
      service_type: serviceType,
      brand: brand || null,
      model_name: modelName || null,
      product_id: String(form.get('product_id') || '').trim() || null,
      product_title: String(form.get('product_title') || '').trim() || null,
      message: String(form.get('message') || '').trim() || null,
      photo_front_url: photoFrontUrl,
      photo_side_url: photoSideUrl,
      photo_label_url: photoLabelUrl,
      photo_back_url: photoBackUrl,
      status: '신규',
      updated_at: new Date().toISOString(),

      // legacy compatibility fields retained by the normalized migration
      name: customerName,
      model: modelName || null,
      front_photo_url: photoFrontUrl,
      side_photo_url: photoSideUrl,
      label_photo_url: photoLabelUrl,
      back_photo_url: photoBackUrl,
    };

    const { data, error } = await supabase
      .from('consultations')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('consultation insert error', error);
      throw new Error(`상담 DB 저장 오류: ${error.message}`);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '상담 등록 오류';
    console.error('consultation POST error', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
