import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const PRIVACY_POLICY_VERSION = '2026-08-10-v1';
const RENTAL_SERVICES = new Set([
  '개인용 안마의자 렌탈',
  '영업용(코인형) 안마의자 렌탈',
]);

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

async function uploadPhoto(
  supabase: ReturnType<typeof getSupabaseServer>,
  file: File | null,
  prefix: string
) {
  if (!file || file.size === 0) return null;
  if (file.size > 10 * 1024 * 1024) throw new Error('사진은 한 장당 10MB 이하만 등록할 수 있습니다.');

  const extension = IMAGE_TYPES[file.type];
  if (!extension) throw new Error('사진은 JPG, PNG, WEBP 형식만 등록할 수 있습니다.');

  const path = `consultations/${Date.now()}-${prefix}-${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('consultation-photos')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;
  return path;
}

// Customer records must never be exposed through the public consultation API.
export async function GET() {
  return NextResponse.json(
    { error: '허용되지 않은 요청입니다.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const form = await request.formData();

    const customerName = String(form.get('customer_name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const address = String(form.get('address') || '').trim();
    const region = String(form.get('region') || '').trim();
    const serviceType = String(form.get('service_type') || '').trim();
    const brand = String(form.get('brand') || '').trim();
    const modelName = String(form.get('model_name') || '').trim();
    const privacyConsent = String(form.get('privacy_consent') || '') === 'agreed';
    const rawProductId = String(form.get('product_id') || '').trim();
    const productId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawProductId)
      ? rawProductId
      : null;

    if (!customerName || !phone || !address || !region || !serviceType) {
      return NextResponse.json(
        { error: '이름, 연락처, 방문 주소, 지역, 서비스는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!privacyConsent) {
      return NextResponse.json(
        { error: '개인정보 수집·이용 안내 확인이 필요합니다.' },
        { status: 400 }
      );
    }

    const isRental = RENTAL_SERVICES.has(serviceType);
    let rentalProduct: {
      title: string | null;
      monthly_fee: number | null;
      deposit_amount: number | null;
      setup_fee: number | null;
      contract_months: number | null;
    } | null = null;

    if (isRental && productId) {
      const { data, error } = await supabase
        .from('products')
        .select('title,monthly_fee,deposit_amount,setup_fee,contract_months')
        .eq('id', productId)
        .eq('listing_type', 'rental')
        .maybeSingle();

      if (error) throw error;
      rentalProduct = data;
    }

    const [photoFrontUrl, photoSideUrl, photoLabelUrl, photoBackUrl] = isRental
      ? [null, null, null, null]
      : await Promise.all([
          uploadPhoto(supabase, form.get('photo_front') as File | null, 'front'),
          uploadPhoto(supabase, form.get('photo_side') as File | null, 'side'),
          uploadPhoto(supabase, form.get('photo_label') as File | null, 'label'),
          uploadPhoto(supabase, form.get('photo_back') as File | null, 'back'),
        ]);

    const consentedAt = new Date();
    const retentionExpiresAt = new Date(consentedAt);
    retentionExpiresAt.setFullYear(retentionExpiresAt.getFullYear() + 1);

    const payload = {
      customer_name: customerName,
      phone,
      address,
      region,
      service_type: serviceType,
      brand: brand || null,
      model_name: modelName || null,
      product_id: productId,
      product_title: rentalProduct?.title || String(form.get('product_title') || '').trim() || null,
      message: String(form.get('message') || '').trim() || null,
      photo_front_url: photoFrontUrl,
      photo_side_url: photoSideUrl,
      photo_label_url: photoLabelUrl,
      photo_back_url: photoBackUrl,
      privacy_consent: true,
      privacy_consent_at: consentedAt.toISOString(),
      privacy_policy_version: PRIVACY_POLICY_VERSION,
      retention_expires_at: retentionExpiresAt.toISOString(),
      rental_stage: isRental ? '상담접수' : null,
      rental_stage_updated_at: isRental ? consentedAt.toISOString() : null,
      rental_monthly_fee: isRental ? Number(rentalProduct?.monthly_fee || 0) : 0,
      rental_deposit_amount: isRental ? Number(rentalProduct?.deposit_amount || 0) : 0,
      rental_setup_fee: isRental ? Number(rentalProduct?.setup_fee || 0) : 0,
      rental_contract_months: isRental ? Number(rentalProduct?.contract_months || 0) : 0,
      status: '신규',
      updated_at: consentedAt.toISOString(),

      // Legacy compatibility fields retained by the normalized migration.
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

    return NextResponse.json({ data: { id: data.id } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '상담 등록 오류';
    console.error('consultation POST error', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
