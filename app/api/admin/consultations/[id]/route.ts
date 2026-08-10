import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { signConsultationPhotoRow } from '@/lib/consultationPhotoAccess';
import { requireAdmin } from '@/lib/adminAuth';

const STATUS = [
  '신규', '상담중', '견적발송', '예약완료', '방문완료', '판매완료',
  '계약완료', '운영중', '계약종료', '종료',
];

const RENTAL_STAGES = [
  '상담접수', '조건확인', '견적발송', '계약대기', '계약완료',
  '설치예약', '운영중', '계약종료', '취소',
] as const;

const RENTAL_STATUS: Record<string, string> = {
  상담접수: '신규',
  조건확인: '상담중',
  견적발송: '견적발송',
  계약대기: '견적발송',
  계약완료: '계약완료',
  설치예약: '예약완료',
  운영중: '운영중',
  계약종료: '계약종료',
  취소: '종료',
};

class InputError extends Error {}

function nonNegativeNumber(value: unknown, label: string) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new InputError(`${label}은 0 이상의 숫자로 입력해 주세요.`);
  }
  return numberValue;
}

function nullableDate(value: unknown, label: string) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new InputError(`${label} 형식이 올바르지 않습니다.`);
  }
  return text;
}

function nullableDateTime(value: unknown, label: string) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new InputError(`${label} 형식이 올바르지 않습니다.`);
  }
  return date.toISOString();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('consultations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return NextResponse.json({ data: await signConsultationPhotoRow(supabase, data) });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHORIZED') {
      return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
    }
    console.error('admin consultation get error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '상담 조회 오류' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseServer();
    const now = new Date();

    if (body.status !== undefined && !STATUS.includes(String(body.status))) {
      throw new InputError('허용되지 않은 상담 상태입니다.');
    }

    const payload: Record<string, unknown> = { updated_at: now.toISOString() };
    if (body.status !== undefined) payload.status = body.status;
    if (body.assignee !== undefined) payload.assignee = String(body.assignee || '').trim() || null;
    if (body.memo !== undefined) payload.memo = String(body.memo || '').trim() || null;
    if (body.estimate_amount !== undefined) {
      payload.estimate_amount = nonNegativeNumber(body.estimate_amount, '견적금액');
    }
    if (body.next_action_at !== undefined) {
      payload.next_action_at = nullableDateTime(body.next_action_at, '다음 일정');
    }
    if (body.region !== undefined) payload.region = String(body.region || '').trim() || null;
    if (body.address !== undefined) payload.address = String(body.address || '').trim() || null;

    if (body.rental_stage !== undefined) {
      const nextStage = String(body.rental_stage || '');
      if (!RENTAL_STAGES.includes(nextStage as (typeof RENTAL_STAGES)[number])) {
        throw new InputError('허용되지 않은 렌탈 진행상태입니다.');
      }

      const { data: current, error: currentError } = await supabase
        .from('consultations')
        .select('service_type,rental_stage,rental_quote_sent_at,rental_contract_signed_at,retention_expires_at')
        .eq('id', id)
        .single();

      if (currentError) throw currentError;
      if (!String(current.service_type || '').includes('렌탈')) {
        throw new InputError('렌탈 상담에만 렌탈 계약정보를 저장할 수 있습니다.');
      }

      payload.rental_stage = nextStage;
      payload.status = RENTAL_STATUS[nextStage];

      if (current.rental_stage !== nextStage) {
        payload.rental_stage_updated_at = now.toISOString();
      }
      if (nextStage === '견적발송' && !current.rental_quote_sent_at) {
        payload.rental_quote_sent_at = now.toISOString();
      }
      if (nextStage === '계약완료' && !current.rental_contract_signed_at) {
        payload.rental_contract_signed_at = now.toISOString();
        const retention = new Date(now);
        retention.setFullYear(retention.getFullYear() + 5);
        payload.retention_expires_at = retention.toISOString();
      }
    }

    if (body.rental_monthly_fee !== undefined) {
      payload.rental_monthly_fee = nonNegativeNumber(body.rental_monthly_fee, '월 렌탈료');
    }
    if (body.rental_deposit_amount !== undefined) {
      payload.rental_deposit_amount = nonNegativeNumber(body.rental_deposit_amount, '보증금');
    }
    if (body.rental_setup_fee !== undefined) {
      payload.rental_setup_fee = nonNegativeNumber(body.rental_setup_fee, '설치비');
    }
    if (body.rental_contract_months !== undefined) {
      const months = Math.trunc(nonNegativeNumber(body.rental_contract_months, '계약기간'));
      if (months > 120) throw new InputError('계약기간은 120개월 이하로 입력해 주세요.');
      payload.rental_contract_months = months;
    }
    if (body.rental_contract_no !== undefined) {
      const contractNo = String(body.rental_contract_no || '').trim();
      if (contractNo.length > 80) throw new InputError('계약번호는 80자 이하로 입력해 주세요.');
      payload.rental_contract_no = contractNo || null;
    }
    if (body.rental_payment_day !== undefined) {
      if (body.rental_payment_day === '' || body.rental_payment_day === null) {
        payload.rental_payment_day = null;
      } else {
        const paymentDay = Math.trunc(Number(body.rental_payment_day));
        if (!Number.isFinite(paymentDay) || paymentDay < 1 || paymentDay > 31) {
          throw new InputError('결제일은 1일부터 31일 사이로 입력해 주세요.');
        }
        payload.rental_payment_day = paymentDay;
      }
    }
    if (body.rental_start_date !== undefined) {
      payload.rental_start_date = nullableDate(body.rental_start_date, '계약 시작일');
    }
    if (body.rental_end_date !== undefined) {
      payload.rental_end_date = nullableDate(body.rental_end_date, '계약 종료일');
    }
    if (body.rental_installation_at !== undefined) {
      payload.rental_installation_at = nullableDateTime(body.rental_installation_at, '설치 예정일');
    }
    if (body.rental_terms_memo !== undefined) {
      const termsMemo = String(body.rental_terms_memo || '').trim();
      if (termsMemo.length > 4000) throw new InputError('렌탈 조건 메모는 4,000자 이하로 입력해 주세요.');
      payload.rental_terms_memo = termsMemo || null;
    }

    const { data, error } = await supabase
      .from('consultations')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ data: await signConsultationPhotoRow(supabase, data) });
  } catch (error) {
    if (error instanceof Error && error.message === 'ADMIN_UNAUTHORIZED') {
      return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
    }
    if (error instanceof InputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('admin consultation patch error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '상담 저장 오류' },
      { status: 500 }
    );
  }
}

