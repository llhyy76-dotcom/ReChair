'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';

type Props={
  consultation:any;
  onUpdated?:()=>void|Promise<void>;
};

function toLocalInput(value:unknown){
  const text=String(value||'');
  if(!text)return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return `${text}T10:00`;
  const date=new Date(text);
  if(Number.isNaN(date.getTime()))return text.slice(0,16);
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60_000);
  return local.toISOString().slice(0,16);
}

function formatDateTime(value:unknown){
  const date=new Date(String(value||''));
  return Number.isNaN(date.getTime())?'-':date.toLocaleString('ko-KR');
}

export default function AdminRentalRetrievalPanel({consultation,onUpdated}:Props){
  const [schedule,setSchedule]=useState<any>(null);
  const [product,setProduct]=useState<any>(null);
  const [technicians,setTechnicians]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [tone,setTone]=useState<'success'|'error'|'working'>('success');
  const [form,setForm]=useState({
    scheduled_at:'',assignee:'',duration_minutes:120,termination_reason:'',memo:'',
  });

  const locked=Boolean(schedule&&['이동중','방문중','작업중','완료'].includes(schedule.status));
  const eligible=['운영중','계약종료'].includes(String(consultation.rental_stage||''));
  const readOnly=locked||!eligible;
  const activeTechnicians=useMemo(
    ()=>technicians.filter(item=>item.is_active),[technicians]
  );

  const load=useCallback(async(preserveMessage=false)=>{
    if(!consultation?.id)return;
    try{
      setLoading(true);
      if(!preserveMessage)setMessage('');
      const [retrievalResponse,technicianResponse]=await Promise.all([
        fetch(`/api/admin/consultations/${consultation.id}/rental-retrieval`,{cache:'no-store'}),
        fetch('/api/admin/technicians',{cache:'no-store'}),
      ]);
      const retrievalResult=await retrievalResponse.json();
      const technicianResult=await technicianResponse.json();
      if(!retrievalResponse.ok||!technicianResponse.ok){
        setTone('error');
        setMessage(retrievalResult.error||technicianResult.error||'회수 정보를 불러오지 못했습니다.');
        return;
      }
      const nextSchedule=retrievalResult.data||null;
      const nextConsultation=retrievalResult.consultation||consultation;
      setSchedule(nextSchedule);
      setProduct(retrievalResult.product||null);
      setTechnicians(technicianResult.data||[]);
      setForm({
        scheduled_at:toLocalInput(nextSchedule?.scheduled_at||nextConsultation.rental_retrieval_at||nextConsultation.rental_end_date),
        assignee:nextSchedule?.assignee||nextConsultation.assignee||'',
        duration_minutes:Number(nextSchedule?.duration_minutes||120),
        termination_reason:nextConsultation.rental_termination_reason||'',
        memo:'',
      });
    }catch(error){
      console.error('rental retrieval panel load error',error);
      setTone('error');
      setMessage('회수 정보를 불러오지 못했습니다.');
    }finally{
      setLoading(false);
    }
  },[consultation?.id]);

  useEffect(()=>{void load(false)},[load]);

  async function save(){
    if(!form.scheduled_at){setTone('error');setMessage('회수 예정일을 입력해 주세요.');return;}
    if(!form.assignee){setTone('error');setMessage('회수 담당기사를 선택해 주세요.');return;}
    if(!form.termination_reason.trim()){setTone('error');setMessage('계약 종료·회수 사유를 입력해 주세요.');return;}
    try{
      setSaving(true);setTone('working');setMessage('회수 일정을 저장하고 있습니다.');
      const localDate=new Date(form.scheduled_at);
      const response=await fetch(`/api/admin/consultations/${consultation.id}/rental-retrieval`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          ...form,
          scheduled_at:Number.isNaN(localDate.getTime())?form.scheduled_at:localDate.toISOString(),
          region:consultation.region,address:consultation.address,
        }),
      });
      const result=await response.json();
      if(!response.ok){setTone('error');setMessage(result.error||'회수 일정 저장 오류');return;}
      setTone('success');
      setMessage(result.created
        ?'회수 일정이 생성되어 현장 캘린더와 기사 화면에 반영되었습니다.'
        :'회수 일정이 변경되었습니다.');
      await load(true);
      await onUpdated?.();
    }catch(error){
      console.error('rental retrieval save error',error);
      setTone('error');setMessage('회수 일정을 저장하지 못했습니다.');
    }finally{
      setSaving(false);
    }
  }

  return <section className="rental-retrieval-panel">
    <header>
      <div><span>RETRIEVAL OPERATIONS</span><h3>계약 종료·제품 회수</h3><p>회수 일정을 기사에게 배정하고 현장 반납상태를 승인합니다.</p></div>
      <b data-state={schedule?.report_approval_status||schedule?.status||'미생성'}>
        {schedule?.report_approval_status==='승인'?'회수 승인완료':schedule?.report_approval_status||schedule?.status||'일정 미생성'}
      </b>
    </header>

    {product&&<div className="rental-retrieval-product">
      <div><span>연결 렌탈상품</span><b>{product.title||product.name||[product.brand,product.model_name||product.model].filter(Boolean).join(' ')}</b></div>
      <div><span>현재 상품상태</span><b>{product.status||'-'}</b></div>
      <div><span>등록 재고</span><b>{Number(product.stock_qty||0)}대</b></div>
    </div>}

    {product&&Number(product.stock_qty||0)>1&&<p className="rental-retrieval-warning">이 상품은 재고가 여러 대이므로 회수 승인 후에도 상품 전체 상태는 자동 변경하지 않습니다. 개별 상품 관리 기능에서 구분해야 합니다.</p>}
    {!product&&<p className="rental-retrieval-warning">연결된 렌탈상품이 없습니다. 회수 일정은 만들 수 있지만 회수 승인 후 상품상태는 자동 변경되지 않습니다.</p>}
    {!eligible&&<p className="rental-retrieval-warning">설치 작업보고가 승인되어 `운영중`이 된 계약부터 회수 일정을 만들 수 있습니다.</p>}

    <div className="rental-retrieval-fields">
      <label><span>회수 예정일</span><input type="datetime-local" value={form.scheduled_at} disabled={readOnly} onChange={event=>setForm({...form,scheduled_at:event.target.value})}/></label>
      <label><span>회수 담당기사</span><select value={form.assignee} disabled={readOnly} onChange={event=>setForm({...form,assignee:event.target.value})}><option value="">기사를 선택하세요</option>{activeTechnicians.map(item=><option key={item.id} value={item.name}>{item.name}{item.team_name?` · ${item.team_name}`:''}</option>)}</select></label>
      <label><span>예상 회수시간</span><div><input type="number" min="30" max="480" step="10" value={form.duration_minutes} disabled={readOnly} onChange={event=>setForm({...form,duration_minutes:Number(event.target.value||120)})}/><em>분</em></div></label>
      <label className="full"><span>계약 종료·회수 사유</span><input value={form.termination_reason} disabled={readOnly} onChange={event=>setForm({...form,termination_reason:event.target.value})} placeholder="예: 계약기간 만료, 고객 중도해지, 제품 교체"/></label>
      <label className="full"><span>기사 전달 메모</span><textarea value={form.memo} disabled={readOnly} onChange={event=>setForm({...form,memo:event.target.value})} placeholder="분해·엘리베이터·주차·부속품 등 현장 참고사항"/></label>
    </div>

    {schedule&&<div className="rental-retrieval-status">
      <span>회수일정 {formatDateTime(schedule.scheduled_at)}</span>
      <span>기사 {schedule.assignee||'미배정'}</span>
      <span>반납상태 {schedule.rental_return_condition||'미보고'}</span>
      <span>후속처리 {schedule.rental_return_disposition||'미보고'}</span>
    </div>}

    {message&&<p className="rental-retrieval-message" data-tone={tone}>{loading?'조회 중…':message}</p>}

    <footer>
      {schedule?.scheduled_at&&<a href={`/admin/schedule?date=${toLocalInput(schedule.scheduled_at).slice(0,10)}`}>현장 캘린더에서 보기</a>}
      <button type="button" onClick={()=>void save()} disabled={loading||saving||readOnly}>{saving?'저장 중…':schedule?'회수 일정 업데이트':'회수 일정 생성'}</button>
    </footer>
  </section>;
}
