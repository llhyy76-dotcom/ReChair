'use client';

import {useCallback,useEffect,useState} from 'react';
import RentalContractDocument from './RentalContractDocument';

const STATUS_LABEL:Record<string,string>={
  draft:'작성 중',sent:'고객 서명 대기',signed:'서명 완료',superseded:'변경계약 완료',void:'취소됨',
};

function money(value:unknown){return `${Number(value||0).toLocaleString('ko-KR')}원`}
function dateTime(value:unknown){
  const date=new Date(String(value||''));
  return Number.isNaN(date.getTime())?'-':date.toLocaleString('ko-KR');
}

async function readResponse(response:Response){
  const text=await response.text();
  if(!text)return {};
  try{return JSON.parse(text)}catch{return {error:`서버 응답 오류 (HTTP ${response.status})`}}
}

export default function AdminRentalContractPanel({
  consultation,
  onRefresh,
}:{
  consultation:any;
  onRefresh?:()=>void|Promise<void>;
}){
  const [contract,setContract]=useState<any>(null);
  const [snapshot,setSnapshot]=useState<any>(null);
  const [history,setHistory]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [shareUrl,setShareUrl]=useState('');
  const [preview,setPreview]=useState(false);
  const endpoint=`/api/admin/consultations/${consultation.id}/rental-contract`;

  const load=useCallback(async(silent=false)=>{
    try{
      if(!silent)setLoading(true);
      const response=await fetch(endpoint,{cache:'no-store'});
      const result=await readResponse(response);
      if(!response.ok){setMessage(result.error||'계약서 조회 오류');return}
      const previousStatus=contract?.status;
      setContract(result.data||null);
      setSnapshot(result.data?.document_snapshot||null);
      setHistory(result.history||[]);
      if(previousStatus==='sent'&&result.data?.status==='signed'){
        setMessage('고객 전자서명이 완료되어 렌탈 단계가 계약완료로 변경되었습니다.');
        await onRefresh?.();
      }
    }catch(error){
      console.error('rental contract load error',error);
      setMessage('계약서 정보를 불러오지 못했습니다.');
    }finally{
      if(!silent)setLoading(false);
    }
  },[consultation.id,endpoint,onRefresh,contract?.status]);

  useEffect(()=>{void load()},[consultation.id]);
  useEffect(()=>{
    if(contract?.status!=='sent')return;
    const timer=window.setInterval(()=>void load(true),10000);
    return()=>window.clearInterval(timer);
  },[contract?.status,load]);

  function patchSnapshot(section:string,key:string,value:unknown){
    setSnapshot((current:any)=>({
      ...current,
      [section]:{...current?.[section],[key]:value},
    }));
  }

  async function create(action='create',sourceContractId?:string){
    try{
      setBusy(true);setMessage('계약서 초안을 만들고 있습니다.');setShareUrl('');
      const response=await fetch(endpoint,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,source_contract_id:sourceContractId}),
      });
      const result=await readResponse(response);
      if(!response.ok){setMessage(result.error||'계약서 생성 오류');if(result.data){setContract(result.data);setSnapshot(result.data.document_snapshot)}return}
      setContract(result.data);setSnapshot(result.data.document_snapshot);
      setMessage(action==='revision'?'변경계약서 초안이 생성되었습니다.':'전자계약서 초안이 생성되었습니다.');
      await load(true);
    }catch(error){
      console.error('rental contract create error',error);setMessage('계약서 생성 요청에 실패했습니다.');
    }finally{setBusy(false)}
  }

  async function saveDraft(quiet=false){
    if(!contract||!snapshot)return false;
    try{
      setBusy(true);if(!quiet)setMessage('계약서를 저장하고 있습니다.');
      const response=await fetch(endpoint,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'save',contract_id:contract.id,snapshot}),
      });
      const result=await readResponse(response);
      if(!response.ok){setMessage(result.error||'계약서 저장 오류');return false}
      setContract(result.data);setSnapshot(result.data.document_snapshot);
      if(!quiet)setMessage('계약서 초안이 저장되었습니다.');
      return true;
    }catch(error){
      console.error('rental contract save error',error);setMessage('계약서를 저장하지 못했습니다.');return false;
    }finally{setBusy(false)}
  }

  async function action(name:string,extra:Record<string,unknown>={}){
    if(!contract)return;
    try{
      setBusy(true);setMessage('계약서 작업을 처리하고 있습니다.');
      const response=await fetch(endpoint,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:name,contract_id:contract.id,...extra}),
      });
      const result=await readResponse(response);
      if(!response.ok){setMessage(result.error||'계약서 처리 오류');return}
      setContract(result.data);setSnapshot(result.data.document_snapshot);
      if(result.share_url){
        setShareUrl(result.share_url);
        setMessage(name==='send'?'고객용 계약 링크가 생성되었습니다. 링크를 고객에게 전달해 주세요.':'고객 열람 링크를 새로 발급했습니다.');
      }else{
        setShareUrl('');setMessage('계약서가 취소되었습니다.');
      }
      await load(true);
      await onRefresh?.();
    }catch(error){
      console.error('rental contract action error',error);setMessage('계약서 작업에 실패했습니다.');
    }finally{setBusy(false)}
  }

  async function send(){
    const saved=await saveDraft(true);
    if(saved)await action('send');
  }

  async function copyLink(){
    if(!shareUrl)return;
    try{
      await navigator.clipboard.writeText(shareUrl);
      setMessage('고객용 계약 링크를 복사했습니다. 문자나 카카오톡으로 전달해 주세요.');
    }catch{
      window.prompt('아래 계약 링크를 복사해 주세요.',shareUrl);
    }
  }

  if(loading)return <section className="rental-contract-admin"><p>전자계약 정보를 불러오는 중입니다.</p></section>;

  return <section className="rental-contract-admin">
    <div className="rental-contract-admin-head">
      <div><span>ELECTRONIC RENTAL CONTRACT</span><h4>전자 렌탈 계약서</h4><p>고객 확인·전자서명이 완료되어야 설치 일정을 생성할 수 있습니다.</p></div>
      <b data-status={contract?.status||'none'}>{contract?STATUS_LABEL[contract.status]||contract.status:'미작성'}</b>
    </div>

    {!contract&&<div className="rental-contract-empty">
      <p>아직 작성된 렌탈 계약서가 없습니다. CRM의 고객·상품·금액 정보를 확인한 후 초안을 만드세요.</p>
      <button type="button" disabled={busy} onClick={()=>void create()}>전자계약서 작성</button>
    </div>}

    {contract&&snapshot&&<>
      <div className="rental-contract-meta">
        <div><span>계약번호</span><b>{contract.contract_no}</b></div>
        <div><span>계약유형</span><b>{contract.contract_type==='commercial'?'영업용·코인형':'개인용'}</b></div>
        <div><span>버전</span><b>v{contract.version}</b></div>
        <div><span>서명일시</span><b>{dateTime(contract.signed_at)}</b></div>
      </div>

      {contract.status==='draft'&&<div className="rental-contract-editor">
        <details open>
          <summary>공급자 정보 <small>계약 발송 전 필수</small></summary>
          <div className="rental-contract-field-grid">
            <label><span>상호</span><input value={snapshot.provider.business_name} onChange={e=>patchSnapshot('provider','business_name',e.target.value)} placeholder="사업자등록증의 상호"/></label>
            <label><span>대표자</span><input value={snapshot.provider.representative} onChange={e=>patchSnapshot('provider','representative',e.target.value)} placeholder="대표자명"/></label>
            <label><span>사업자등록번호</span><input value={snapshot.provider.business_number} onChange={e=>patchSnapshot('provider','business_number',e.target.value)} placeholder="000-00-00000"/></label>
            <label><span>연락처</span><input value={snapshot.provider.phone} onChange={e=>patchSnapshot('provider','phone',e.target.value)} placeholder="고객센터 연락처"/></label>
            <label className="wide"><span>사업장 주소</span><input value={snapshot.provider.address} onChange={e=>patchSnapshot('provider','address',e.target.value)} placeholder="사업자등록증의 사업장 주소"/></label>
          </div>
        </details>

        <details open>
          <summary>고객·제품·계약 조건</summary>
          <div className="rental-contract-customer-readonly">
            <div><span>고객</span><b>{snapshot.customer.name}</b></div><div><span>연락처</span><b>{snapshot.customer.phone}</b></div><div><span>설치주소</span><b>{snapshot.customer.installation_address}</b></div>
          </div>
          <div className="rental-contract-field-grid">
            <label className="wide"><span>상품명</span><input value={snapshot.product.title} onChange={e=>patchSnapshot('product','title',e.target.value)}/></label>
            <label><span>브랜드</span><input value={snapshot.product.brand} onChange={e=>patchSnapshot('product','brand',e.target.value)}/></label>
            <label><span>모델명</span><input value={snapshot.product.model_name} onChange={e=>patchSnapshot('product','model_name',e.target.value)}/></label>
            <label><span>제조번호</span><input value={snapshot.product.serial_number} onChange={e=>patchSnapshot('product','serial_number',e.target.value)} placeholder="설치 전 미정이면 공란"/></label>
            <label><span>월 렌탈료</span><input type="number" min="0" value={snapshot.pricing.monthly_fee} onChange={e=>patchSnapshot('pricing','monthly_fee',Number(e.target.value))}/></label>
            <label><span>보증금</span><input type="number" min="0" value={snapshot.pricing.deposit_amount} onChange={e=>patchSnapshot('pricing','deposit_amount',Number(e.target.value))}/></label>
            <label><span>설치비</span><input type="number" min="0" value={snapshot.pricing.setup_fee} onChange={e=>patchSnapshot('pricing','setup_fee',Number(e.target.value))}/></label>
            <label><span>매월 결제일</span><input type="number" min="1" max="31" value={snapshot.pricing.payment_day||''} onChange={e=>patchSnapshot('pricing','payment_day',Number(e.target.value))}/></label>
            <label><span>결제방법</span><input value={snapshot.pricing.payment_method} onChange={e=>patchSnapshot('pricing','payment_method',e.target.value)}/></label>
            <label><span>계약기간</span><input type="number" min="1" max="120" value={snapshot.period.contract_months} onChange={e=>patchSnapshot('period','contract_months',Number(e.target.value))}/></label>
            <label><span>시작일</span><input type="date" value={snapshot.period.start_date} onChange={e=>patchSnapshot('period','start_date',e.target.value)}/></label>
            <label><span>종료일</span><input type="date" value={snapshot.period.end_date} onChange={e=>patchSnapshot('period','end_date',e.target.value)}/></label>
          </div>
        </details>

        <details>
          <summary>계약 조항 검토 <small>발송 전에 실제 영업조건에 맞게 확인</small></summary>
          <div className="rental-contract-term-fields">
            {[
              ['ownership','소유권'],['installation_relocation','설치·이전'],['maintenance_repair','유지보수·수리'],['loss_damage','분실·파손'],['early_termination','중도해지'],['withdrawal','청약철회·해지권'],['privacy','개인정보 처리'],
              ...(contract.contract_type==='commercial'?[['commercial_operation','영업용 운영·정산']]:[]),
              ['special_terms','특약사항'],
            ].map(([key,label])=><label key={key}><span>{label}</span><textarea value={snapshot.terms[key]||''} onChange={e=>patchSnapshot('terms',key,e.target.value)}/></label>)}
          </div>
        </details>
      </div>}

      {contract.status!=='draft'&&<div className="rental-contract-summary">
        <div><span>공급자</span><b>{snapshot.provider.business_name} · {snapshot.provider.representative}</b></div>
        <div><span>고객</span><b>{snapshot.customer.name} · {snapshot.customer.phone}</b></div>
        <div><span>상품</span><b>{snapshot.product.title}</b></div>
        <div><span>계약조건</span><b>월 {money(snapshot.pricing.monthly_fee)} · {snapshot.period.contract_months}개월</b></div>
        {contract.signature_url&&<img src={contract.signature_url} alt="고객 전자서명"/>}
        <small>문서 검증값 {String(contract.document_sha256||'').slice(0,20)}…</small>
      </div>}

      {shareUrl&&<div className="rental-contract-share"><input readOnly value={shareUrl}/><button type="button" onClick={()=>void copyLink()}>링크 복사</button><a href={shareUrl} target="_blank" rel="noreferrer">고객 화면 열기</a></div>}
      {message&&<p className="rental-contract-message" role="status">{message}</p>}

      <div className="rental-contract-actions">
        <button type="button" className="light" onClick={()=>setPreview(true)}>계약내용 미리보기</button>
        {contract.status==='draft'&&<><button type="button" disabled={busy} onClick={()=>void saveDraft()}>{busy?'처리 중…':'초안 저장'}</button><button type="button" disabled={busy} onClick={()=>void send()}>저장 후 고객 링크 생성</button><button type="button" className="danger" disabled={busy} onClick={()=>void action('void',{reason:'작성 중 계약 취소'})}>초안 취소</button></>}
        {contract.status==='sent'&&<><button type="button" disabled={busy} onClick={()=>void action('share')}>고객 링크 재발급</button><button type="button" className="danger" disabled={busy} onClick={()=>void action('void',{reason:'서명 전 계약 취소'})}>계약 발송 취소</button></>}
        {['signed','superseded'].includes(contract.status)&&<><button type="button" disabled={busy} onClick={()=>void action('share')}>열람 링크 발급</button><button type="button" disabled={busy} onClick={()=>void create('revision',contract.id)}>변경계약서 작성</button></>}
        {contract.status==='void'&&<button type="button" disabled={busy} onClick={()=>void create()}>새 계약서 작성</button>}
      </div>

      {history.length>1&&<details className="rental-contract-history"><summary>계약 이력 {history.length}건</summary>{history.map(item=><div key={item.id}><b>v{item.version} · {item.contract_no}</b><span>{STATUS_LABEL[item.status]||item.status} · {dateTime(item.signed_at||item.sent_at||item.voided_at)}</span></div>)}</details>}

      {preview&&<div className="rental-contract-preview-backdrop" onClick={()=>setPreview(false)}><article className="rental-contract-preview" onClick={e=>e.stopPropagation()}>
        <div className="rental-contract-preview-tools"><button onClick={()=>setPreview(false)}>닫기</button><button onClick={()=>window.print()}>인쇄·PDF 저장</button></div>
        <RentalContractDocument snapshot={snapshot} contract={contract}/>
      </article></div>}
    </>}
    {!contract&&message&&<p className="rental-contract-message">{message}</p>}
  </section>;
}
