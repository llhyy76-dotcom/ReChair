import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const ACTIVE_STATUSES = ['신규', '상담중', '견적발송', '예약완료'];
const COMPLETED_STATUSES = ['방문완료', '판매완료', '종료'];

function countBy(
  rows: Record<string, unknown>[],
  key: string
): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();

  for (const row of rows) {
    const value = String(row[key] || '미분류');
    map.set(value, (map.get(value) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const item = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return [
      item.message,
      item.details,
      item.hint,
      item.code ? `코드: ${item.code}` : null,
    ]
      .filter(Boolean)
      .join(' / ');
  }

  return String(error || '알 수 없는 오류');
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const [consultationsResult, productsResult] = await Promise.all([
      supabase
        .from('consultations')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    if (consultationsResult.error) {
      throw consultationsResult.error;
    }

    if (productsResult.error) {
      throw productsResult.error;
    }

    const consultations =
      (consultationsResult.data || []) as Record<string, any>[];

    const products =
      (productsResult.data || []) as Record<string, any>[];

    const consultationStatus = countBy(
      consultations,
      'status'
    ).map((item) => ({
      status: item.name,
      count: item.count,
    }));

    const serviceCounts = countBy(
      consultations,
      'service_type'
    ).map((item) => ({
      service_type: item.name,
      count: item.count,
    }));

    const totalEstimateAmount = consultations.reduce(
      (sum, item) =>
        sum +
        Number(
          item.estimate_amount ??
          item.quote ??
          0
        ),
      0
    );

   const normalizedConsultations = consultations.map((item) => ({
  ...item,

  id: String(item.id ?? ''),

  customer_name:
    item.customer_name ??
    item.name ??
    '이름 없음',

  phone:
    item.phone ??
    '',

  service_type:
    item.service_type ??
    item.service ??
    '미분류',

  product_id:
    item.product_id ??
    null,

  product_title:
    item.product_title ??
    null,

  status:
    item.status ??
    '신규',

  estimate_amount:
    Number(
      item.estimate_amount ??
      item.quote ??
      0
    ),

  created_at:
    item.created_at ??
    null,
}));

    const normalizedProducts = products.map((item) => ({
      ...item,
      title:
        item.title ??
        item.model_name ??
        '상품명 없음',

      brand:
        item.brand ??
        '',

      model_name:
        item.model_name ??
        '',

      price:
        Number(item.price || 0),

      status:
        item.status ??
        '판매중',

      is_visible:
        item.is_visible !== false,
    }));

    const summary = {
      total_consultations: normalizedConsultations.length,

      new_consultations: normalizedConsultations.filter(
        (item) => (item.status || '신규') === '신규'
      ).length,

      in_progress_consultations: normalizedConsultations.filter(
        (item) =>
          ACTIVE_STATUSES.includes(item.status || '신규')
      ).length,

      completed_consultations: normalizedConsultations.filter(
        (item) =>
          COMPLETED_STATUSES.includes(item.status || '')
      ).length,

      product_consultations: normalizedConsultations.filter(
        (item) =>
          Boolean(item.product_id || item.product_title)
      ).length,

      total_products: normalizedProducts.length,

      visible_products: normalizedProducts.filter(
        (item) => item.is_visible !== false
      ).length,

      sold_out_products: normalizedProducts.filter(
        (item) => item.status === '판매완료'
      ).length,

      total_estimate_amount: totalEstimateAmount,
    };

    return NextResponse.json({
      data: {
        summary,
        consultation_status: consultationStatus,
        service_counts: serviceCounts,
        recent_consultations:
          normalizedConsultations.slice(0, 8),
        recent_products:
          normalizedProducts.slice(0, 6),
      },
    });
  } catch (error) {
    console.error('Admin dashboard API error:', error);

    return NextResponse.json(
      {
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
