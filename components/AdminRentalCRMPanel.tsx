'use client';

const RENTAL_STAGES = [
  { value: '상담접수', label: '상담 접수', note: '고객 문의 접수' },
  { value: '조건확인', label: '조건 확인', note: '설치·계약 조건 확인' },
  { value: '견적발송', label: '견적 발송', note: '고객에게 금액 안내' },
  { value: '계약대기', label: '계약 대기', note: '고객 결정 대기' },
  { value: '계약완료', label: '계약 완료', note: '계약 체결' },
  { value: '설치예약', label: '설치 예약', note: '설치 일정 확정' },
  { value: '운영중', label: '운영 중', note: '렌탈 서비스 이용' },
  { value: '계약종료', label: '계약 종료', note: '회수·인수 처리' },
  { value: '취소', label: '취소', note: '상담·계약 취소' },
] as const;

type RentalPanelProps = {
  consultation: any;
  onChange: (key: string, value: unknown) => void;
  onSave: () => void | Promise<void>;
};

function formatMoney(value: unknown) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: unknown) {
  const text = String(value || '');
  if (!text) return '-';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('ko-KR');
}

function toLocalDateTimeInput(value: unknown) {
  const text = String(value || '');
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 16);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function addMonths(startDate: string, monthsValue: unknown) {
  const months = Math.max(0, Math.trunc(Number(monthsValue || 0)));
  if (!startDate || !months) return '';

  const [year, month, day] = startDate.split('-').map(Number);
  if (!year || !month || !day) return '';

  const targetMonthStart = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0
  )).getUTCDate();
  const end = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth(),
    Math.min(day, lastDay)
  ));
  return end.toISOString().slice(0, 10);
}

export default function AdminRentalCRMPanel({
  consultation,
  onChange,
  onSave,
}: RentalPanelProps) {
  const stage = consultation.rental_stage || '상담접수';
  const stageIndex = Math.max(0, RENTAL_STAGES.findIndex((item) => item.value === stage));
  const isClosed = stage === '계약종료' || stage === '취소';

  function changeStartDate(value: string) {
    onChange('rental_start_date', value || null);
    const calculatedEnd = addMonths(value, consultation.rental_contract_months);
    if (calculatedEnd) onChange('rental_end_date', calculatedEnd);
  }

  function changeMonths(value: string) {
    const months = Math.max(0, Math.trunc(Number(value || 0)));
    onChange('rental_contract_months', months);
    const calculatedEnd = addMonths(consultation.rental_start_date || '', months);
    if (calculatedEnd) onChange('rental_end_date', calculatedEnd);
  }

  return (
    <section className="rental-crm-panel">
      <div className="rental-crm-head">
        <div>
          <p>RENTAL WORKFLOW</p>
          <h3>렌탈 견적·계약 관리</h3>
          <span>상담부터 계약, 설치와 운영 상태를 이 상담 건에서 관리합니다.</span>
        </div>
        <div className={`rental-stage-badge ${isClosed ? 'closed' : ''}`}>
          <span>현재 단계</span>
          <strong>{stage}</strong>
        </div>
      </div>

      <div className="rental-stage-flow" aria-label="렌탈 진행 단계">
        {RENTAL_STAGES.map((item, index) => {
          const active = item.value === stage;
          const passed = !isClosed && index < stageIndex;
          return (
            <button
              type="button"
              key={item.value}
              className={`${active ? 'active' : ''} ${passed ? 'passed' : ''}`.trim()}
              onClick={() => onChange('rental_stage', item.value)}
              aria-pressed={active}
            >
              <b>{index + 1}</b>
              <span>{item.label}</span>
              <small>{item.note}</small>
            </button>
          );
        })}
      </div>

      <div className="rental-amount-summary">
        <div><span>월 렌탈료</span><b>{formatMoney(consultation.rental_monthly_fee)}</b></div>
        <div><span>초기 납부 예상</span><b>{formatMoney(Number(consultation.rental_deposit_amount || 0) + Number(consultation.rental_setup_fee || 0))}</b></div>
        <div><span>계약 기간</span><b>{Number(consultation.rental_contract_months || 0)}개월</b></div>
        <div><span>설치 예정</span><b>{formatDateTime(consultation.rental_installation_at)}</b></div>
      </div>

      <div className="rental-crm-fields">
        <label>
          <span>월 렌탈료</span>
          <div className="rental-money-input"><input type="number" min="0" step="1000" value={consultation.rental_monthly_fee ?? 0} onChange={(event) => onChange('rental_monthly_fee', Number(event.target.value))}/><em>원</em></div>
        </label>
        <label>
          <span>보증금</span>
          <div className="rental-money-input"><input type="number" min="0" step="1000" value={consultation.rental_deposit_amount ?? 0} onChange={(event) => onChange('rental_deposit_amount', Number(event.target.value))}/><em>원</em></div>
        </label>
        <label>
          <span>설치비</span>
          <div className="rental-money-input"><input type="number" min="0" step="1000" value={consultation.rental_setup_fee ?? 0} onChange={(event) => onChange('rental_setup_fee', Number(event.target.value))}/><em>원</em></div>
        </label>
        <label>
          <span>계약기간</span>
          <div className="rental-money-input"><input type="number" min="0" max="120" value={consultation.rental_contract_months ?? 0} onChange={(event) => changeMonths(event.target.value)}/><em>개월</em></div>
        </label>
        <label>
          <span>계약번호</span>
          <input value={consultation.rental_contract_no || ''} onChange={(event) => onChange('rental_contract_no', event.target.value)} placeholder="예: RC-2026-0001"/>
        </label>
        <label>
          <span>매월 결제일</span>
          <div className="rental-money-input"><input type="number" min="1" max="31" value={consultation.rental_payment_day ?? ''} onChange={(event) => onChange('rental_payment_day', event.target.value ? Number(event.target.value) : null)} placeholder="1~31"/><em>일</em></div>
        </label>
        <label>
          <span>계약 시작일</span>
          <input type="date" value={consultation.rental_start_date || ''} onChange={(event) => changeStartDate(event.target.value)}/>
        </label>
        <label>
          <span>계약 종료일</span>
          <input type="date" value={consultation.rental_end_date || ''} onChange={(event) => onChange('rental_end_date', event.target.value || null)}/>
        </label>
        <label className="rental-installation-field">
          <span>설치 예정일</span>
          <input type="datetime-local" value={toLocalDateTimeInput(consultation.rental_installation_at)} onChange={(event) => onChange('rental_installation_at', event.target.value || null)}/>
        </label>
      </div>

      <label className="rental-terms-memo">
        <span>렌탈 조건·계약 메모</span>
        <textarea value={consultation.rental_terms_memo || ''} onChange={(event) => onChange('rental_terms_memo', event.target.value)} placeholder="중도해지, 소유권 이전, 설치 조건, 특약사항 등을 기록하세요."/>
      </label>

      <div className="rental-crm-foot">
        <div>
          <span>견적 발송 {formatDateTime(consultation.rental_quote_sent_at)}</span>
          <span>계약 완료 {formatDateTime(consultation.rental_contract_signed_at)}</span>
        </div>
        <button type="button" onClick={() => void onSave()}>렌탈 정보 저장</button>
      </div>
    </section>
  );
}
