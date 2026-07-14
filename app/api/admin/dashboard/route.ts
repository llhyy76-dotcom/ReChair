import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const STATUS_ORDER = ['신규','상담중','견적발송','예약완료','방문완료','판매완료','종료'];

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint, e.code].filter(Boolean).join(' / ');
  }
  return String(error || '관리자 대시보드 조회 오류');
}

function normalizeStatus(value: unknown) {
  const raw = String(value || '신규').trim();
  const aliases: Record<string,string> = {
    '견적완료':'견적발송',
    '예약':'예약완료',
    '완료':'방문완료',
    '상담 진행':'상담중',
  };
  const result = aliases[raw] || raw;
  return STATUS_ORDER.includes(result) ? result : '신규';
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const [cRes, pRes] = await Promise.all([
      supabase.from('consultations').select('*').order('created_at', { ascending:false }),
      supabase.from('products').select('*').order('created_at', { ascending:false }),
    ]);

    if (cRes.error) throw cRes.error;
    if (pRes.error) throw pRes.error;

    const consultations = ((cRes.data || []) as Record<string,any>[]).map((item) => ({
      ...item,
      id: String(item.id ?? ''),
      customer_name: item.customer_name ?? item.name ?? '이름 없음',
      phone: item.phone ?? '',
      service_type: item.service_type ?? item.service ?? '미분류',
      product_id: item.product_id ?? null,
      product_title: item.product_title ?? null,
      brand: item.brand ?? null,
      model_name: item.model_name ?? item.model ?? null,
      status: normalizeStatus(item.status),
      estimate_amount: Number(item.estimate_amount ?? item.quote ?? 0),
      created_at: item.created_at ?? null,
    }));

    const products = ((pRes.data || []) as Record<string,any>[]).map((item) => ({
      ...item,
      id: String(item.id ?? ''),
      title: item.title ?? item.model_name ?? '상품명 없음',
      brand: item.brand ?? '',
      model_name: item.model_name ?? '',
      price: Number(item.price || 0),
      status: String(item.status || '판매중'),
      is_visible: item.is_visible !== false,
      thumbnail_url: item.thumbnail_url ?? null,
      created_at: item.created_at ?? null,
    }));

    const consultation_status = STATUS_ORDER.map((status) => ({
      status,
      count: consultations.filter((item) => item.status === status).length,
    }));

    const serviceMap = new Map<string,number>();
    consultations.forEach((item) => {
      serviceMap.set(item.service_type, (serviceMap.get(item.service_type) || 0) + 1);
    });
    const service_counts = [...serviceMap.entries()]
      .map(([service_type,count]) => ({ service_type,count }))
      .sort((a,b) => b.count - a.count);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dated = (value: string | null) => value ? new Date(value) : null;

    const summary = {
      total_consultations: consultations.length,
      new_consultations: consultations.filter(i => i.status === '신규').length,
      consulting_consultations: consultations.filter(i => i.status === '상담중').length,
      quoted_consultations: consultations.filter(i => i.status === '견적발송').length,
      reserved_consultations: consultations.filter(i => i.status === '예약완료').length,
      completed_consultations: consultations.filter(i => i.status === '방문완료').length,
      sold_consultations: consultations.filter(i => i.status === '판매완료').length,
      closed_consultations: consultations.filter(i => i.status === '종료').length,
      product_consultations: consultations.filter(i => i.product_id || i.product_title).length,
      total_products: products.length,
      selling_products: products.filter(i => i.is_visible && i.status === '판매중').length,
      reserved_products: products.filter(i => i.status === '예약중').length,
      sold_out_products: products.filter(i => i.status === '판매완료').length,
      hidden_products: products.filter(i => !i.is_visible).length,
      total_estimate_amount: consultations.reduce((s,i) => s + i.estimate_amount, 0),
      today_consultations: consultations.filter(i => {
        const d = dated(i.created_at); return d && d >= today;
      }).length,
      today_completed: consultations.filter(i => {
        const d = dated(i.created_at);
        return d && d >= today && ['방문완료','판매완료','종료'].includes(i.status);
      }).length,
      today_quotes: consultations.filter(i => {
        const d = dated(i.created_at); return d && d >= today && i.status === '견적발송';
      }).length,
      today_sales: consultations.filter(i => {
        const d = dated(i.created_at); return d && d >= today && i.status === '판매완료';
      }).length,
      month_estimate_amount: consultations
        .filter(i => { const d = dated(i.created_at); return d && d >= monthStart; })
        .reduce((s,i) => s + i.estimate_amount, 0),
    };

    return NextResponse.json({
      data: {
        summary,
        consultation_status,
        service_counts,
        recent_consultations: consultations.slice(0,30),
        recent_products: products.slice(0,8),
      },
    });
  } catch (error) {
    console.error('Admin dashboard API error:', error);
    return NextResponse.json({ error:errorText(error) }, { status:500 });
  }
}
