import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const photoFields = ['photo_front', 'photo_side', 'photo_label', 'photo_back'];

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
}

async function uploadFile(supabase: ReturnType<typeof createClient>, consultationId: string, field: string, file: File) {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${consultationId}/${field}-${Date.now()}-${safeName(file.name || `photo.${ext}`)}`;
  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from('consultation-photos')
    .upload(path, Buffer.from(bytes), {
      contentType: file.type || 'image/jpeg',
      upsert: true
    });

  if (error) throw error;
  const { data } = supabase.storage.from('consultation-photos').getPublicUrl(path);
  return data.publicUrl;
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({
      data: [
        {
          id: 'demo-1',
          name: '홍길동',
          phone: '010-0000-0000',
          service_type: '중고 안마의자 판매',
          model: '코지마 CMC-A100',
          message: '제품 매입 상담을 원합니다.',
          status: '신규',
          created_at: new Date().toISOString(),
          photo_front: null,
          photo_side: null,
          photo_label: null,
          photo_back: null,
          extra_photos: []
        }
      ],
      mock: true
    });
  }

  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const formData = await request.formData();

  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const service_type = String(formData.get('service_type') || '').trim();
  const model = String(formData.get('model') || '').trim();
  const message = String(formData.get('message') || '').trim();

  if (!name || !phone) {
    return NextResponse.json({ error: '이름과 연락처는 필수입니다.' }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: true, mock: true, message: 'Supabase 환경변수 미설정 상태입니다.' });
  }

  const { data: created, error: insertError } = await supabase
    .from('consultations')
    .insert({
      name,
      phone,
      service_type,
      model,
      message,
      status: '신규',
      timeline: [{ at: new Date().toISOString(), label: '상담 접수' }]
    })
    .select('id')
    .single();

  if (insertError || !created?.id) {
    return NextResponse.json({ error: insertError?.message || '접수 생성 실패' }, { status: 500 });
  }

  const consultationId = created.id;
  const photoUrls: Record<string, string | null> = {};
  const extraUrls: string[] = [];

  try {
    for (const field of photoFields) {
      const file = formData.get(field);
      if (file instanceof File && file.size > 0) {
        photoUrls[field] = await uploadFile(supabase, consultationId, field, file);
      }
    }

    const extraFiles = formData.getAll('extra_photos');
    for (const item of extraFiles) {
      if (item instanceof File && item.size > 0) {
        extraUrls.push(await uploadFile(supabase, consultationId, 'extra', item));
      }
    }

    const { error: updateError } = await supabase
      .from('consultations')
      .update({ ...photoUrls, extra_photos: extraUrls, updated_at: new Date().toISOString() })
      .eq('id', consultationId);

    if (updateError) throw updateError;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '사진 업로드 실패' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: consultationId });
}
