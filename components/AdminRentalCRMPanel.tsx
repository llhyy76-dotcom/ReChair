'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import AdminRentalContractPanel from './AdminRentalContractPanel';
import AdminRentalAssetAssignment from './AdminRentalAssetAssignment';

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
  onSave: () => boolean | Promise<boolean>;
  onRefresh?: () => void | Promise<void>;
  saving?: boolean;
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
  onRefresh,
  saving=false,
}: RentalPanelProps) {
  const [technicians,setTechnicians]=useState<any[]>([]);
  const [installationSchedule,setInstallationSchedule]=useState<any>(null);
  const [durationMinutes,setDurationMinutes]=useState(120);
  const [scheduleMessage,setScheduleMessage]=useState('');
  const [scheduleLoading,setScheduleLoading]=useState(false);
  const [panelSaving,setPanelSaving]=useState(false);
  const [panelSaveMessage,setPanelSaveMessage]=useState('');
  const stage = consultation.rental_stage || '상담접수';
  const stageIndex = Math.max(0, RENTAL_STAGES.findIndex((item) => item.value === stage));
  const isClosed = stage === '계약종료' || stage === '취소';
  const hasSignedContract=Boolean(
    consultation.rental_contract_id&&consultation.rental_contract_signed_at
  );
  const installationLocked=Boolean(
    installationSchedule&&['이동중','방문중','작업중','완료'].includes(installationSchedule.status)
  );
  const activeTechnicians=useMemo(
    ()=>technicians.filter((item)=>item.is_active),
    [technicians]
  );

  const loadInstallation=useCallback(async()=>{
    if(!consultation?.id)return;
    try{
      setScheduleLoading(true);
      setScheduleMessage('');
      const [scheduleResponse,technicianResponse]=await Promise.all([
        fetch(`/api/admin/consultations/${consultation.id}/rental-installation`,{cache:'no-store'}),
        fetch('/api/admin/technicians',{cache:'no-store'}),
      ]);
      const scheduleResult=await scheduleResponse.json();
      const technicianResult=await technicianResponse.json();
      if(!scheduleResponse.ok||!technicianResponse.ok){
        setScheduleMessage(
          scheduleResult.error||technicianResult.error||'설치 일정 정보를 불러오지 못했습니다.'
        );
        return;
      }
      setInstallationSchedule(scheduleResult.data||null);
      setTechnicians(technicianResult.data||[]);
      if(scheduleResult.data?.duration_minutes){
        setDurationMinutes(Number(scheduleResult.data.duration_minutes));
      }
    }catch(error){
      console.error('rental installation load error',error);
      setScheduleMessage('설치 일정 정보를 불러오지 못했습니다.');
    }finally{
      setScheduleLoading(false);
    }
  },[consultation?.id]);

  useEffect(()=>{void loadInstallation()},[loadInstallation]);

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

  async function saveRentalInfo(){
    try{
      setPanelSaving(true);
      setPanelSaveMessage('저장 중…');
      const saved=await onSave();
      setPanelSaveMessage(
        saved
          ?`저장 완료 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`
          :'저장되지 않았습니다. 화면 하단 오류 안내를 확인해 주세요.'
      );
      return saved;
    }catch(error){
      console.error('rental info save error',error);
      setPanelSaveMessage('저장 요청 중 오류가 발생했습니다.');
      return false;
    }finally{
      setPanelSaving(false);
    }
  }

  async function syncInstallation(){
    if(!hasSignedContract){
      setScheduleMessage('고객 전자서명이 완료된 계약서가 있어야 설치 일정을 생성할 수 있습니다.');
      return;
    }
    if(!consultation.rental_installation_at){
      setScheduleMessage('설치 예정일을 입력해 주세요.');
      return;
    }
    if(!String(consultation.assignee||'').trim()){
      setScheduleMessage('설치 담당기사를 선택해 주세요.');
      return;
    }
    if(!String(consultation.region||'').trim()||!String(consultation.address||'').trim()){
      setScheduleMessage('상담 상세의 방문 위치에서 지역과 주소를 먼저 저장해 주세요.');
      return;
    }

    try{
      setScheduleLoading(true);
      setScheduleMessage('렌탈 정보와 설치 일정을 저장하고 있습니다.');
      const saved=await onSave();
      if(!saved){
        setScheduleMessage('렌탈 정보 저장에 실패하여 설치 일정을 생성하지 않았습니다. 화면 하단 오류 안내를 확인해 주세요.');
        return;
      }
      const localDate=new Date(consultation.rental_installation_at);
      const response=await fetch(
        `/api/admin/consultations/${consultation.id}/rental-installation`,
        {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            scheduled_at:Number.isNaN(localDate.getTime())
              ?consultation.rental_installation_at
              :localDate.toISOString(),
            assignee:consultation.assignee,
            duration_minutes:durationMinutes,
            region:consultation.region,
            address:consultation.address,
          }),
        }
      );
      const result=await response.json();
      if(!response.ok){
        setScheduleMessage(result.error||'설치 일정 저장 오류');
        return;
      }
      setInstallationSchedule(result.data);
      setScheduleMessage(
        result.created
          ?'렌탈 설치 일정이 생성되어 기사 화면과 현장 캘린더에 반영되었습니다.'
          :'렌탈 설치 일정이 변경되었습니다.'
      );
      await onRefresh?.();
    }catch(error){
      console.error('rental installation sync error',error);
      setScheduleMessage('설치 일정을 저장하지 못했습니다.');
    }finally{
      setScheduleLoading(false);
    }
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
          const needsSignedContract=['계약완료','설치예약','운영중'].includes(item.value);
          const contractLocked=needsSignedContract&&!hasSignedContract;
          const operatingLocked=item.value==='운영중'&&!active&&!consultation.rental_operating_started_at;
          return (
            <button
              type="button"
              key={item.value}
              className={`${active ? 'active' : ''} ${passed ? 'passed' : ''}`.trim()}
              onClick={() => onChange('rental_stage', item.value)}
              aria-pressed={active}
              disabled={contractLocked||operatingLocked}
              title={contractLocked
                ?'고객 전자서명이 완료되면 계약완료 단계로 자동 전환됩니다.'
                :operatingLocked
                  ?'설치 작업보고가 관리자 승인되면 자동 전환됩니다.'
                  :undefined}
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

      <AdminRentalContractPanel
        consultation={consultation}
        onRefresh={onRefresh}
      />

      <AdminRentalAssetAssignment
        consultationId={consultation.id}
        onRefresh={onRefresh}
      />

      <section className="rental-installation-link">
        <div className="rental-installation-head">
          <div>
            <span>INSTALLATION OPERATIONS</span>
            <h4>설치 일정·기사 연동</h4>
            <p>계약 완료 후 설치 일정을 생성하면 현장 캘린더와 담당기사 화면에 동시에 표시됩니다.</p>
          </div>
          <b data-state={installationSchedule?.status||'미생성'}>
            {installationSchedule?.status||'일정 미생성'}
          </b>
        </div>

        <div className="rental-installation-controls">
          <label>
            <span>설치 담당기사</span>
            <select
              value={consultation.assignee||''}
              onChange={(event)=>onChange('assignee',event.target.value||null)}
              disabled={installationLocked}
            >
              <option value="">기사를 선택하세요</option>
              {activeTechnicians.map((technician)=><option key={technician.id} value={technician.name}>{technician.name}{technician.team_name?` · ${technician.team_name}`:''}</option>)}
            </select>
          </label>
          <label>
            <span>예상 설치시간</span>
            <div className="rental-money-input">
              <input
                type="number"
                min="30"
                max="480"
                step="10"
                value={durationMinutes}
                disabled={installationLocked}
                onChange={(event)=>setDurationMinutes(Number(event.target.value||120))}
              />
              <em>분</em>
            </div>
          </label>
        </div>

        {installationSchedule&&<div className="rental-installation-summary">
          <span>일정 {formatDateTime(installationSchedule.scheduled_at)}</span>
          <span>기사 {installationSchedule.assignee||'미배정'}</span>
          <span>보고 검토 {installationSchedule.report_approval_status||'미제출'}</span>
        </div>}

        {scheduleMessage&&<p className="rental-installation-message">{scheduleMessage}</p>}

        <div className="rental-installation-actions">
          {installationSchedule?.scheduled_at&&<a href={`/admin/schedule?date=${toLocalDateTimeInput(installationSchedule.scheduled_at).slice(0,10)}`}>현장 캘린더에서 보기</a>}
          <button
            type="button"
            onClick={()=>void syncInstallation()}
            disabled={scheduleLoading||installationLocked||!hasSignedContract}
            title={!hasSignedContract?'고객 전자서명이 완료된 후 설치 일정을 생성할 수 있습니다.':undefined}
          >
            {scheduleLoading?'처리 중…':installationSchedule?'설치 일정 업데이트':'설치 일정 생성'}
          </button>
        </div>
      </section>

      <div className="rental-crm-foot">
        <div>
          <span>견적 발송 {formatDateTime(consultation.rental_quote_sent_at)}</span>
          <span>계약 완료 {formatDateTime(consultation.rental_contract_signed_at)}</span>
          {panelSaveMessage&&<strong className="rental-save-result">{panelSaveMessage}</strong>}
        </div>
        <div className="rental-crm-foot-actions">
          <a href={`/admin/rental/operations?consultation_id=${consultation.id}`}>운영·납부 보기</a>
          <button type="button" disabled={saving||panelSaving} onClick={() => void saveRentalInfo()}>{saving||panelSaving?'저장 중…':'렌탈 정보 저장'}</button>
        </div>
      </div>
    </section>
  );
}
