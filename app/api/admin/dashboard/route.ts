import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const ACTIVE_STATUSES = ['신규', '상담중', '견적발송', '예약완료'];
const COMPLETED_STATUSES = ['방문완료', '판매완료', '종료'];

function countBy<T extends Record<string, any>>(rows: T[], key: keyof T) {
  const map = new Map<string, number>();

  for (const row of rows) {
    const value = String(row[key] || '미분류');
    map.set(value, (map.get(value) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const [
      consultationsResult,
      productsResult,
    ] = await Promise.all([
      supabase
        .from('consultations')
        .select(
          'id,customer_name,phone,service_type,product_id,product_title,status,estimate_amount,created_at'
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select(
          'id,title,brand,model_name,price,status,is_visible,thumbnail_url,created_at'
        )
        .order('created_at', { ascending: false }),
    ]);

    if (consultationsResult.error) throw consultationsResult.error;
    if (productsResult.error) throw productsResult.error;

    const consultations = consultationsResult.data || [];
    const products = productsResult.data || [];

    const consultationStatus = countBy(consultations, 'status').map((item) => ({
      status: item.name,
      count: item.count,
    }));

    const serviceCounts = countBy(consultations, 'service_type').map((item) => ({
      service_type: item.name,
      count: item.count,
    }));

    const totalEstimateAmount = consultations.reduce(
      (sum, item) => sum + Number(item.estimate_amount || 0),
      0
    );

    const summary = {
      total_consultations: consultations.length,
      new_consultations: consultations.filter(
        (item) => (item.status || '신규') === '신규'
      ).length,
      in_progress_consultations: consultations.filter((item) =>
        ACTIVE_STATUSES.includes(item.status || '신규')
      ).length,
      completed_consultations: consultations.filter((item) =>
        COMPLETED_STATUSES.includes(item.status || '')
      ).length,
      product_consultations: consultations.filter((item) => Boolean(item.product_id)).length,
      total_products: products.length,
      visible_products: products.filter((item) => item.is_visible !== false).length,
      sold_out_products: products.filter((item) => item.status === '판매완료').length,
      total_estimate_amount: totalEstimateAmount,
    };

    return NextResponse.json({
      data: {
        summary,
        consultation_status: consultationStatus,
        service_counts: serviceCounts,
        recent_consultations: consultations.slice(0, 8),
        recent_products: products.slice(0, 6),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '관리자 대시보드 조회 오류',
      },
      { status: 500 }
    );
  }
}
