'use client';

import {useCallback,useEffect,useState} from 'react';
import RentalContractDocument from './RentalContractDocument';

const STATUS_LABEL:Record<string,string>={
  draft:'작성 중',sent:'고객 서명 대기',signed:'서명 완료',superseded:'변경계약 완료',void:'취소됨',
};

const CUSTOMER_ENTITY_LABEL:Record<string,string>={
  individual:'개인',sole_proprietor:'개인사업자',corporation:'법인사업자',
};

const EMPTY_PROVIDER={
  entity_type:'sole_proprietor',
  business_name:'',
  representative:'',
  business_number:'',
  corporate_number:'',
  address:'',
  phone:'',
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
  const [provider,setProvider]=useState<any>(EMPTY_PROVIDER);
  const [providerConfigured,setProviderConfigured]=useState(false);
  const [providerBusy,setProviderBusy]=useState(false);
  const [providerMessage,setProviderMessage]=useState('');
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

  const loadProvider=useCallback(async()=>{
    try{
      const response=await fetch('/api/admin/rental-contract-provider',{cache:'no-store'});
      const result=await readResponse(response);
      if(!response.ok){setProviderMessage(result.error||'공급자 기본정보 조회 오류');return}
      setProvider({...EMPTY_PROVIDER,...result.data});
      setProviderConfigured(result.configured===true);
    }catch(error){
      console.error('rental provider load error',error);
      setProviderMessage('공급자 기본정보를 불러오지 못했습니다.');
    }
  },[]);

  useEffect(()=>{void load()},[consultation.id]);
  useEffect(()=>{void loadProvider()},[loadProvider]);
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

  function changeCustomerEntity(value:string){
    setSnapshot((current:any)=>{
      const customer=current?.customer||{};
      return {
        ...current,
        customer:{
          business_name:'',representative:'',business_number:'',corporate_number:'',
          business_address:'',signer_title:'',signer_authority_confirmed:false,
          ...customer,
          entity_type:value,
          signer_name:value==='individual'?customer.name||'':customer.signer_name||'',
        },
      };
    });
  }

  function changeProvider(key:string,value:unknown){
    setProvider((current:any)=>({...current,[key]:value}));
  }

  function applyProviderToDraft(nextProvider=provider){
    if(contract?.status!=='draft')return;
    setSnapshot((current:any)=>({...current,provider:{...nextProvider}}));
    setProviderMessage('공급자 정보를 현재 초안에 적용했습니다. 계약서의 초안 저장을 눌러 확정해 주세요.');
  }

  async function saveProvider(){
    try{
      setProviderBusy(true);setProviderMessage('공급자 기본정보를 저장하고 있습니다.');
      const response=await fetch('/api/admin/rental-contract-provider',{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(provider),
      });
      const result=await readResponse(response);
      if(!response.ok){setProviderMessage(result.error||'공급자 기본정보 저장 오류');return}
      setProvider(result.data);setProviderConfigured(true);
      if(contract?.status==='draft'){
        setSnapshot((current:any)=>({...current,provider:{...result.data}}));
      }
      setProviderMessage(
        contract?.status==='draft'
          ?'공급자 기본정보를 저장하고 현재 초안에 적용했습니다. 계약서의 초안 저장을 눌러 확정해 주세요.'
          :'공급자 기본정보를 저장했습니다. 다음 계약서부터 자동 적용됩니다.'
      );
    }catch(error){
      console.error('rental provider save error',error);
      setProviderMessage('공급자 기본정보를 저장하지 못했습니다.');
    }finally{setProviderBusy(false)}
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

    <section className="rental-provider-settings">
      <div className="rental-provider-settings-head">
        <div>
          <b>렌탈 공급자 기본정보</b>
          <span>{providerConfigured?'저장된 정보가 새 계약서에 자동 적용됩니다.':'최초 1회 저장이 필요합니다.'}</span>
        </div>
        <em data-configured={providerConfigured}>{providerConfigured?'설정 완료':'설정 필요'}</em>
      </div>
      <details open={!providerConfigured}>
        <summary>공급자 정보 확인·수정</summary>
        <div className="rental-provider-type">
          <label><input type="radio" name="provider_entity_type" checked={provider.entity_type==='sole_proprietor'} onChange={()=>changeProvider('entity_type','sole_proprietor')}/><span>개인사업자</span></label>
          <label><input type="radio" name="provider_entity_type" checked={provider.entity_type==='corporation'} onChange={()=>changeProvider('entity_type','corporation')}/><span>법인사업자</span></label>
        </div>
        <div className="rental-contract-field-grid">
          <label><span>{provider.entity_type==='corporation'?'법인명':'상호'}</span><input value={provider.business_name||''} onChange={e=>changeProvider('business_name',e.target.value)} placeholder="사업자등록증과 동일하게 입력"/></label>
          <label><span>대표자</span><input value={provider.representative||''} onChange={e=>changeProvider('representative',e.target.value)} placeholder="대표자명"/></label>
          <label><span>사업자등록번호</span><input value={provider.business_number||''} onChange={e=>changeProvider('business_number',e.target.value)} placeholder="000-00-00000"/></label>
          {provider.entity_type==='corporation'&&<label><span>법인등록번호</span><input value={provider.corporate_number||''} onChange={e=>changeProvider('corporate_number',e.target.value)} placeholder="000000-0000000"/></label>}
          <label><span>연락처</span><input value={provider.phone||''} onChange={e=>changeProvider('phone',e.target.value)} placeholder="고객센터 연락처"/></label>
          <label className="wide"><span>{provider.entity_type==='corporation'?'본점 주소':'사업장 주소'}</span><input value={provider.address||''} onChange={e=>changeProvider('address',e.target.value)} placeholder="사업자등록증과 동일하게 입력"/></label>
        </div>
        <div className="rental-provider-actions">
          {contract?.status==='draft'&&providerConfigured&&<button type="button" className="light" onClick={()=>applyProviderToDraft()}>현재 초안에 적용</button>}
          <button type="button" disabled={providerBusy} onClick={()=>void saveProvider()}>{providerBusy?'저장 중…':'공급자 기본정보 저장'}</button>
        </div>
      </details>
      {providerMessage&&<p className="rental-contract-message" role="status">{providerMessage}</p>}
    </section>

    {!contract&&<div className="rental-contract-empty">
      <p>아직 작성된 렌탈 계약서가 없습니다. CRM의 고객·상품·금액 정보를 확인한 후 초안을 만드세요.</p>
      <button type="button" disabled={busy} onClick={()=>void create()}>전자계약서 작성</button>
    </div>}

    {contract&&snapshot&&<>
      <div className="rental-contract-meta">
        <div><span>계약번호</span><b>{contract.contract_no}</b></div>
        <div><span>렌탈유형</span><b>{contract.contract_type==='commercial'?'영업용·코인형':'개인용'}</b></div>
        <div><span>계약자</span><b>{CUSTOMER_ENTITY_LABEL[snapshot.customer?.entity_type]||'선택 필요'}</b></div>
        <div><span>버전</span><b>v{contract.version}</b></div>
        <div><span>서명일시</span><b>{dateTime(contract.signed_at)}</b></div>
      </div>

      {contract.status==='draft'&&<div className="rental-contract-editor">
        <details open>
          <summary>계약서 공급자 정보 <small>저장된 기본정보의 계약 시점 사본</small></summary>
          <div className="rental-contract-customer-readonly provider-snapshot">
            <div><span>{snapshot.provider?.entity_type==='corporation'?'법인명':'상호'}</span><b>{snapshot.provider?.business_name||'미입력'}</b></div>
            <div><span>대표자</span><b>{snapshot.provider?.representative||'미입력'}</b></div>
            <div><span>사업자등록번호</span><b>{snapshot.provider?.business_number||'미입력'}</b></div>
            {snapshot.provider?.entity_type==='corporation'&&<div><span>법인등록번호</span><b>{snapshot.provider?.corporate_number||'미입력'}</b></div>}
            <div><span>연락처</span><b>{snapshot.provider?.phone||'미입력'}</b></div>
            <div><span>주소</span><b>{snapshot.provider?.address||'미입력'}</b></div>
          </div>
        </details>

        <details open>
          <summary>계약자 유형·정보 <small>개인과 사업자 계약을 구분합니다.</small></summary>
          <div className="rental-customer-type" role="group" aria-label="계약자 유형">
            {[
              ['individual','개인','이름·연락처·설치주소'],
              ['sole_proprietor','개인사업자','상호·대표자·사업자번호'],
              ['corporation','법인사업자','법인정보·서명권한'],
            ].map(([value,label,note])=><button
              type="button"
              key={value}
              className={snapshot.customer?.entity_type===value?'active':''}
              onClick={()=>changeCustomerEntity(value)}
            ><b>{label}</b><small>{note}</small></button>)}
          </div>

          {snapshot.customer?.entity_type==='individual'&&<div className="rental-contract-field-grid customer-fields">
            <label><span>계약자 이름</span><input value={snapshot.customer?.name||''} onChange={e=>patchSnapshot('customer','name',e.target.value)}/></label>
            <label><span>휴대전화</span><input value={snapshot.customer?.phone||''} onChange={e=>patchSnapshot('customer','phone',e.target.value)} placeholder="010-0000-0000"/></label>
            <label className="wide"><span>설치주소</span><input value={snapshot.customer?.installation_address||''} onChange={e=>patchSnapshot('customer','installation_address',e.target.value)}/></label>
          </div>}

          {['sole_proprietor','corporation'].includes(snapshot.customer?.entity_type)&&<>
            <div className="rental-contract-field-grid customer-fields">
              <label><span>{snapshot.customer.entity_type==='corporation'?'법인명':'상호'}</span><input value={snapshot.customer?.business_name||''} onChange={e=>patchSnapshot('customer','business_name',e.target.value)} placeholder="사업자등록증과 동일하게 입력"/></label>
              <label><span>대표자</span><input value={snapshot.customer?.representative||''} onChange={e=>patchSnapshot('customer','representative',e.target.value)}/></label>
              <label><span>사업자등록번호</span><input value={snapshot.customer?.business_number||''} onChange={e=>patchSnapshot('customer','business_number',e.target.value)} placeholder="000-00-00000"/></label>
              {snapshot.customer.entity_type==='corporation'&&<label><span>법인등록번호</span><input value={snapshot.customer?.corporate_number||''} onChange={e=>patchSnapshot('customer','corporate_number',e.target.value)} placeholder="000000-0000000"/></label>}
              <label className="wide"><span>{snapshot.customer.entity_type==='corporation'?'본점 주소':'사업장 주소'}</span><input value={snapshot.customer?.business_address||''} onChange={e=>patchSnapshot('customer','business_address',e.target.value)}/></label>
              <label><span>연락 담당자</span><input value={snapshot.customer?.name||''} onChange={e=>patchSnapshot('customer','name',e.target.value)}/></label>
              <label><span>연락처</span><input value={snapshot.customer?.phone||''} onChange={e=>patchSnapshot('customer','phone',e.target.value)} placeholder="010-0000-0000"/></label>
              <label className="wide"><span>설치주소</span><input value={snapshot.customer?.installation_address||''} onChange={e=>patchSnapshot('customer','installation_address',e.target.value)}/></label>
              <label><span>계약 서명자</span><input value={snapshot.customer?.signer_name||''} onChange={e=>patchSnapshot('customer','signer_name',e.target.value)} placeholder="실제 서명할 사람"/></label>
              {snapshot.customer.entity_type==='corporation'&&<label><span>서명자 직책</span><input value={snapshot.customer?.signer_title||''} onChange={e=>patchSnapshot('customer','signer_title',e.target.value)} placeholder="예: 대표이사, 부장"/></label>}
            </div>
            <label className="rental-signer-authority"><input type="checkbox" checked={snapshot.customer?.signer_authority_confirmed===true} onChange={e=>patchSnapshot('customer','signer_authority_confirmed',e.target.checked)}/><span>위 서명자가 해당 사업자·법인을 대표하여 이 렌탈 계약을 체결할 권한이 있음을 확인했습니다.</span></label>
          </>}

          {!snapshot.customer?.entity_type&&<p className="rental-contract-select-required">계약서를 발송하기 전에 계약자 유형을 선택해 주세요.</p>}
        </details>

        <details open>
          <summary>제품·금액·계약기간</summary>
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
              ...(['sole_proprietor','corporation'].includes(snapshot.customer?.entity_type)?[['business_transaction','사업자 계약·서명권한']]:[]),
              ...(contract.contract_type==='commercial'?[['commercial_operation','영업용 운영·정산']]:[]),
              ['special_terms','특약사항'],
            ].map(([key,label])=><label key={key}><span>{label}</span><textarea value={snapshot.terms[key]||''} onChange={e=>patchSnapshot('terms',key,e.target.value)}/></label>)}
          </div>
        </details>
      </div>}

      {contract.status!=='draft'&&<div className="rental-contract-summary">
        <div><span>공급자</span><b>{snapshot.provider.business_name} · {snapshot.provider.representative}</b></div>
        <div><span>계약자 · {CUSTOMER_ENTITY_LABEL[snapshot.customer?.entity_type]||'기존 계약'}</span><b>{snapshot.customer?.entity_type&&snapshot.customer.entity_type!=='individual'?snapshot.customer.business_name:snapshot.customer.name} · {snapshot.customer.phone}</b></div>
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
