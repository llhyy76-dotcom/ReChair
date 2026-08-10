import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { signConsultationPhotoRows } from '@/lib/consultationPhotoAccess';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const status = request.nextUrl.searchParams.get('status');
    const service = request.nextUrl.searchParams.get('service');
    const keyword = request.nextUrl.searchParams.get('q');

    let query = supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (status) query = query.eq('status', status);
    if (service) query = query.eq('service_type', service);

    if (keyword) {
      const safeKeyword = keyword.replace(/[%_,]/g, ' ');
      query = query.or(
        `customer_name.ilike.%${safeKeyword}%,phone.ilike.%${safeKeyword}%,region.ilike.%${safeKeyword}%,model_name.ilike.%${safeKeyword}%,product_title.ilike.%${safeKeyword}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const ids = (data || []).map((item: any) => item.id).filter(Boolean);
    const scheduleCounts: Record<string, number> = {};

    if (ids.length) {
      const { data: schedules, error: scheduleError } = await supabase
        .from('service_schedules')
        .select('consultation_id')
        .in('consultation_id', ids);

      if (scheduleError) throw scheduleError;

      for (const schedule of schedules || []) {
        if (schedule.consultation_id) {
          scheduleCounts[schedule.consultation_id] =
            (scheduleCounts[schedule.consultation_id] || 0) + 1;
        }
      }
    }

    const normalized = (data || []).map((item: any) => ({
      ...item,
      customer_name: item.customer_name ?? item.name ?? '이름 없음',
      service_type: item.service_type ?? item.service ?? '미분류',
      model_name: item.model_name ?? item.model ?? null,
      assignee: item.assignee ?? item.manager ?? null,
      estimate_amount: Number(item.estimate_amount ?? item.quote ?? 0),
      status: item.status ?? '신규',
      schedule_count: scheduleCounts[item.id] || 0,
    }));

    const securedRows = await signConsultationPhotoRows(supabase, normalized);
    return NextResponse.json({ data: securedRows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '상담 조회 오류' },
      { status: 500 }
    );
  }
}

