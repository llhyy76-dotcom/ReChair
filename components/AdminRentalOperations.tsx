'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';

type RentalRow={
  id:string;
  customer_name?:string|null;
  phone?:string|null;
  region?:string|null;
  address?:string|null;
  service_type?:string|null;
  product_title?:string|null;
  brand?:string|null;
  model_name?:string|null;
  rental_stage?:string|null;
  rental_contract_no?:string|null;
  rental_monthly_fee?:number|null;
  rental_payment_day?:number|null;
  rental_start_date?:string|null;
  rental_end_date?:string|null;
  rental_contract_months?:number|null;
  billing_status:string;
  payment_count:number;
  paid_count:number;
  overdue_count:number;
  total_paid:number;
  next_due_date?:string|null;
  next_due_amount?:number|null;
  contract_days_remaining?:number|null;
  contract_expiring?:boolean;
  contract_expired?:boolean;
};

type Payment={
  id:string;
  consultation_id:string;
  billing_month:string;
  due_date:string;
  amount:number;
  status:'납부예정'|'납부완료'|'면제'|'취소';
  paid_at?:string|null;
  payment_method?:string|null;
  memo?:string|null;
};

type Filter='전체'|'운영중'|'미납'|'청구미생성'|'종료임박';
const FILTERS:Filter[]=['전체','운영중','미납','청구미생성','종료임박'];

function money(value:unknown){
  return `${Number(value||0).toLocaleString('ko-KR')}원`;
}

function date(value:unknown){
  const text=String(value||'');
  if(!text)return '-';
  const parsed=new Date(`${text.slice(0,10)}T00:00:00+09:00`);
  return Number.isNaN(parsed.getTime())?'-':parsed.toLocaleDateString('ko-KR');
}

function dateTime(value:unknown){
  const text=String(value||'');
  if(!text)return '-';
  const parsed=new Date(text);
  return Number.isNaN(parsed.getTime())?'-':parsed.toLocaleString('ko-KR');
}

function localDateTime(value:unknown){
  const parsed=new Date(String(value||new Date().toISOString()));
  const local=new Date(parsed.getTime()-parsed.getTimezoneOffset()*60_000);
  return local.toISOString().slice(0,16);
}

function paymentDisplayStatus(payment:Payment,today:string){
  if(payment.status==='납부예정'&&payment.due_date<today)return '미납';
  return payment.status;
}

export default function AdminRentalOperations(){
  const [rows,setRows]=useState<RentalRow[]>([]);
  const [summary,setSummary]=useState<any>({});
  const [today,setToday]=useState('');
  const [selected,setSelected]=useState<RentalRow|null>(null);
  const [payments,setPayments]=useState<Payment[]>([]);
  const [filter,setFilter]=useState<Filter>('전체');
  const [query,setQuery]=useState('');
  const [message,setMessage]=useState('');
  const [tone,setTone]=useState<'success'|'error'|'working'>('success');
  const [loading,setLoading]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [paymentSaving,setPaymentSaving]=useState(false);
  const [editing,setEditing]=useState<Payment|null>(null);
  const [paymentForm,setPaymentForm]=useState({
    amount:0,
    paid_at:localDateTime(new Date()),
    payment_method:'계좌이체',
    memo:'',
  });

  const notify=(text:string,nextTone:'success'|'error'|'working'='success')=>{
    setMessage(text);setTone(nextTone);
  };

  async function result(response:Response){
    const text=await response.text();
    if(!text)return {};
    try{return JSON.parse(text)}catch{return {error:`서버 응답 오류 (HTTP ${response.status})`}}
  }

  const load=useCallback(async(keepId?:string)=>{
    try{
      setLoading(true);
      const params=new URLSearchParams();
      if(query.trim())params.set('q',query.trim());
      const response=await fetch(`/api/admin/rental/operations?${params.toString()}`,{cache:'no-store'});
      const body=await result(response);
      if(!response.ok){notify(body.error||'렌탈 운영현황 조회 오류','error');return;}
      const nextRows=body.data||[];
      setRows(nextRows);
      setSummary(body.summary||{});
      setToday(body.today||'');
      const targetId=keepId||selected?.id;
      if(targetId){
        const nextSelected=nextRows.find((item:RentalRow)=>item.id===targetId)||null;
        setSelected(nextSelected);
      }
    }catch(error){
      console.error('rental operations load error',error);
      notify('렌탈 운영현황을 불러오지 못했습니다.','error');
    }finally{
      setLoading(false);
    }
  },[query,selected?.id]);

  const loadPayments=useCallback(async(id:string)=>{
    try{
      const response=await fetch(`/api/admin/consultations/${id}/rental-payments`,{cache:'no-store'});
      const body=await result(response);
      if(!response.ok){notify(body.error||'납부내역 조회 오류','error');return;}
      setPayments(body.data||[]);
    }catch(error){
      console.error('rental payments load error',error);
      notify('납부내역을 불러오지 못했습니다.','error');
    }
  },[]);

  useEffect(()=>{void load()},[]);
  useEffect(()=>{if(selected?.id)void loadPayments(selected.id);else setPayments([])},[selected?.id,loadPayments]);

  const filtered=useMemo(()=>rows.filter(row=>{
    if(filter==='운영중')return row.rental_stage==='운영중';
    if(filter==='미납')return row.billing_status==='미납';
    if(filter==='청구미생성')return row.billing_status==='청구미생성';
    if(filter==='종료임박')return row.contract_expiring||row.contract_expired;
    return true;
  }),[rows,filter]);

  const paymentSummary=useMemo(()=>{
    const paid=payments.filter(item=>item.status==='납부완료');
    const overdue=payments.filter(item=>paymentDisplayStatus(item,today)==='미납');
    return {
      total:payments.length,
      paid:paid.length,
      overdue:overdue.length,
      amount:paid.reduce((sum,item)=>sum+Number(item.amount||0),0),
    };
  },[payments,today]);

  async function selectRow(row:RentalRow){
    setSelected(row);
    setPayments([]);
    const url=new URL(window.location.href);
    url.searchParams.set('consultation_id',row.id);
    window.history.replaceState({},'',url);
  }

  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('consultation_id');
    if(id&&rows.length){
      const target=rows.find(item=>item.id===id);
      if(target)setSelected(target);
    }
  },[rows]);

  async function generatePayments(replaceExisting=false){
    if(!selected)return;
    if(payments.length&&!replaceExisting){
      notify('이미 청구일정이 있습니다. 기존 납부내역은 그대로 유지됩니다.','error');
      return;
    }
    try{
      setGenerating(true);
      notify('계약조건을 기준으로 월 청구일정을 생성하고 있습니다.','working');
      const response=await fetch(`/api/admin/consultations/${selected.id}/rental-payments`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({replace_existing:replaceExisting}),
      });
      const body=await result(response);
      if(!response.ok){notify(body.error||'청구일정 생성 오류','error');return;}
      setPayments(body.data||[]);
      notify(`${body.generated||0}개월 청구일정이 준비되었습니다.`,'success');
      await load(selected.id);
    }catch(error){
      console.error('payment schedule generate error',error);
      notify('청구일정을 생성하지 못했습니다.','error');
    }finally{
      setGenerating(false);
    }
  }

  function openPayment(payment:Payment){
    setEditing(payment);
    setPaymentForm({
      amount:Number(payment.amount||0),
      paid_at:localDateTime(payment.paid_at||new Date()),
      payment_method:payment.payment_method||'계좌이체',
      memo:payment.memo||'',
    });
  }

  async function updatePayment(status:'납부완료'|'납부예정'|'면제'){
    if(!editing||!selected)return;
    try{
      setPaymentSaving(true);
      notify('납부내역을 저장하고 있습니다.','working');
      const response=await fetch(`/api/admin/rental-payments/${editing.id}`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          ...paymentForm,
          paid_at:paymentForm.paid_at?new Date(paymentForm.paid_at).toISOString():null,
          status,
        }),
      });
      const body=await result(response);
      if(!response.ok){notify(body.error||'납부내역 저장 오류','error');return;}
      notify(status==='납부완료'?'납부 완료로 저장되었습니다.':status==='면제'?'해당 월이 면제 처리되었습니다.':'납부예정으로 되돌렸습니다.','success');
      setEditing(null);
      await Promise.all([loadPayments(selected.id),load(selected.id)]);
    }catch(error){
      console.error('payment update error',error);
      notify('납부내역을 저장하지 못했습니다.','error');
    }finally{
      setPaymentSaving(false);
    }
  }

  return <main className="rental-ops-page">
    <section className="rental-ops-shell">
      <header className="rental-ops-title">
        <div>
          <p>RECHAIR RENTAL OPERATIONS</p>
          <h1>렌탈 운영·납부센터</h1>
          <span>운영 중 계약의 월 납부, 미납 및 계약 종료 예정일을 관리합니다.</span>
        </div>
        <nav>
          <a href="/admin/rental">상담·계약관리</a>
          <a href="/admin/schedule">현장 캘린더</a>
        </nav>
      </header>

      <section className="rental-ops-summary">
        <button onClick={()=>setFilter('전체')} className={filter==='전체'?'active':''}><span>전체 렌탈</span><b>{summary.total||0}</b></button>
        <button onClick={()=>setFilter('운영중')} className={filter==='운영중'?'active':''}><span>운영 중</span><b>{summary.operating||0}</b></button>
        <button onClick={()=>setFilter('미납')} className={`danger ${filter==='미납'?'active':''}`}><span>미납 고객</span><b>{summary.overdue||0}</b></button>
        <button onClick={()=>setFilter('청구미생성')} className={filter==='청구미생성'?'active':''}><span>청구 미생성</span><b>{summary.no_schedule||0}</b></button>
        <button onClick={()=>setFilter('종료임박')} className={`warning ${filter==='종료임박'?'active':''}`}><span>종료 임박·경과</span><b>{Number(summary.expiring||0)+Number(summary.expired||0)}</b></button>
      </section>

      <section className="rental-ops-toolbar">
        <div>{FILTERS.map(item=><button key={item} className={filter===item?'on':''} onClick={()=>setFilter(item)}>{item}</button>)}</div>
        <form onSubmit={event=>{event.preventDefault();void load()}}>
          <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="고객명·전화·계약번호·상품 검색"/>
          <button disabled={loading}>{loading?'조회 중':'검색'}</button>
        </form>
      </section>

      {message&&<aside className="rental-ops-message" data-tone={tone} role="status"><b>{tone==='error'?'!':tone==='working'?'…':'✓'}</b><span>{message}</span><button onClick={()=>setMessage('')}>×</button></aside>}

      <section className="rental-ops-workspace">
        <div className="rental-contract-list">
          <div className="rental-list-head"><b>{filter}</b><span>{filtered.length}건</span></div>
          {filtered.length?filtered.map(row=><button key={row.id} className={selected?.id===row.id?'selected':''} onClick={()=>void selectRow(row)}>
            <div className="rental-row-head"><strong>{row.customer_name||'이름 없음'}</strong><em data-status={row.billing_status}>{row.billing_status}</em></div>
            <span>{row.phone||'-'} · {row.region||'지역 미입력'}</span>
            <p>{row.product_title||[row.brand,row.model_name].filter(Boolean).join(' ')||row.service_type||'렌탈 상품'}</p>
            <footer><small>{row.rental_contract_no||'계약번호 미입력'}</small><b>{money(row.rental_monthly_fee)}/월</b></footer>
          </button>):<div className="rental-ops-empty">조건에 맞는 렌탈 계약이 없습니다.</div>}
        </div>

        <div className="rental-payment-detail">
          {!selected?<div className="rental-ops-empty large"><b>렌탈 계약을 선택하세요.</b><span>왼쪽 목록에서 고객을 선택하면 납부일정이 표시됩니다.</span></div>:<>
            <div className="rental-detail-head">
              <div><span>{selected.rental_stage||'상태 미입력'}</span><h2>{selected.customer_name} 고객</h2><p>{selected.phone||'-'} · {selected.address||selected.region||'주소 미입력'}</p></div>
              <div><a href={`tel:${selected.phone||''}`}>고객 전화</a><a href={`/admin/rental?consultation_id=${selected.id}`}>계약정보 보기</a></div>
            </div>

            <section className="rental-contract-cards">
              <article><span>월 렌탈료</span><strong>{money(selected.rental_monthly_fee)}</strong></article>
              <article><span>결제일</span><strong>매월 {selected.rental_payment_day||'-'}일</strong></article>
              <article><span>계약기간</span><strong>{date(selected.rental_start_date)} ~ {date(selected.rental_end_date)}</strong></article>
              <article data-alert={selected.contract_expired||selected.contract_expiring}><span>종료까지</span><strong>{selected.contract_days_remaining===null||selected.contract_days_remaining===undefined?'-':selected.contract_days_remaining<0?`${Math.abs(selected.contract_days_remaining)}일 경과`:`${selected.contract_days_remaining}일`}</strong></article>
            </section>

            <section className="rental-payment-summary">
              <div><span>전체 청구</span><b>{paymentSummary.total}회</b></div>
              <div><span>납부 완료</span><b>{paymentSummary.paid}회</b></div>
              <div className={paymentSummary.overdue?'danger':''}><span>미납</span><b>{paymentSummary.overdue}회</b></div>
              <div><span>누적 납부</span><b>{money(paymentSummary.amount)}</b></div>
              <button disabled={generating} onClick={()=>{
                if(!payments.length){void generatePayments(false);return;}
                if(window.confirm('납부완료·면제 기록은 유지하고 나머지 청구일정을 현재 계약조건으로 다시 계산할까요?'))void generatePayments(true);
              }}>{generating?'생성 중…':payments.length?'청구일정 다시 계산':'계약기간 청구일정 생성'}</button>
            </section>

            {payments.length?<div className="rental-payment-table-wrap"><table className="rental-payment-table">
              <thead><tr><th>회차</th><th>청구월</th><th>납부기한</th><th>금액</th><th>상태</th><th>납부일</th><th>처리</th></tr></thead>
              <tbody>{payments.map((payment,index)=>{
                const display=paymentDisplayStatus(payment,today);
                return <tr key={payment.id} data-status={display}>
                  <td data-label="회차">{index+1}회</td>
                  <td data-label="청구월">{payment.billing_month.slice(0,7)}</td>
                  <td data-label="납부기한">{date(payment.due_date)}</td>
                  <td data-label="금액"><b>{money(payment.amount)}</b></td>
                  <td data-label="상태"><span>{display}</span></td>
                  <td data-label="납부일">{dateTime(payment.paid_at)}</td>
                  <td data-label="처리"><button onClick={()=>openPayment(payment)}>{payment.status==='납부완료'?'상세·수정':'납부 처리'}</button></td>
                </tr>;
              })}</tbody>
            </table></div>:<div className="rental-billing-empty"><b>월 청구일정이 없습니다.</b><p>계약 시작일, 계약기간, 월 렌탈료와 결제일을 확인한 후 청구일정을 생성하세요.</p><button disabled={generating} onClick={()=>void generatePayments(false)}>계약기간 청구일정 생성</button></div>}
          </>}
        </div>
      </section>
    </section>

    {editing&&<div className="rental-payment-backdrop" onClick={()=>setEditing(null)}>
      <section className="rental-payment-modal" onClick={event=>event.stopPropagation()}>
        <header><div><p>{editing.billing_month.slice(0,7)} 청구</p><h2>렌탈 납부 처리</h2><span>납부기한 {date(editing.due_date)}</span></div><button onClick={()=>setEditing(null)}>×</button></header>
        <div className="rental-payment-fields">
          <label><span>납부금액</span><input type="number" min="0" step="1000" value={paymentForm.amount} onChange={event=>setPaymentForm({...paymentForm,amount:Number(event.target.value)})}/></label>
          <label><span>납부일시</span><input type="datetime-local" value={paymentForm.paid_at} onChange={event=>setPaymentForm({...paymentForm,paid_at:event.target.value})}/></label>
          <label><span>결제방법</span><select value={paymentForm.payment_method} onChange={event=>setPaymentForm({...paymentForm,payment_method:event.target.value})}><option>계좌이체</option><option>카드</option><option>현금</option><option>자동이체</option><option>기타</option></select></label>
          <label className="full"><span>납부 메모</span><textarea value={paymentForm.memo} onChange={event=>setPaymentForm({...paymentForm,memo:event.target.value})} placeholder="입금자명, 특이사항 등을 기록하세요."/></label>
        </div>
        <footer><button disabled={paymentSaving} className="secondary" onClick={()=>void updatePayment('납부예정')}>납부예정으로 변경</button><button disabled={paymentSaving} className="secondary" onClick={()=>void updatePayment('면제')}>면제 처리</button><button disabled={paymentSaving} onClick={()=>void updatePayment('납부완료')}>{paymentSaving?'저장 중…':'납부완료 저장'}</button></footer>
      </section>
    </div>}
  </main>;
}
