'use client';

import {FormEvent,useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import RentalContractDocument from './RentalContractDocument';

async function readResponse(response:Response){
  const text=await response.text();
  if(!text)return {};
  try{return JSON.parse(text)}catch{return {error:`서버 응답 오류 (HTTP ${response.status})`}}
}

export default function RentalContractCustomer({token}:{token:string}){
  const [contract,setContract]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [verificationRequired,setVerificationRequired]=useState(false);
  const [maskedPhone,setMaskedPhone]=useState('');
  const [phone,setPhone]=useState('');
  const [signerName,setSignerName]=useState('');
  const [contractConsent,setContractConsent]=useState(false);
  const [privacyConsent,setPrivacyConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [drawn,setDrawn]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawingRef=useRef(false);
  const endpoint=`/api/rental-contracts/${encodeURIComponent(token)}`;

  async function load(){
    try{
      setLoading(true);setError('');
      const response=await fetch(endpoint,{cache:'no-store'});
      const result=await readResponse(response);
      if(response.status===401&&result.verification_required){
        setVerificationRequired(true);setMaskedPhone(result.masked_phone||'');return;
      }
      if(!response.ok){setError(result.error||'계약서를 불러오지 못했습니다.');return}
      setContract(result.data);setVerificationRequired(false);
      const customer=result.data?.document_snapshot?.customer;
      setSignerName(
        customer?.entity_type&&customer.entity_type!=='individual'
          ?customer?.signer_name||''
          :customer?.name||''
      );
    }catch(error){
      console.error('customer contract load error',error);setError('계약서를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
    }finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[token]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||contract?.status!=='sent')return;
    const rect=canvas.getBoundingClientRect();
    const ratio=Math.max(1,window.devicePixelRatio||1);
    canvas.width=Math.max(1,Math.floor(rect.width*ratio));
    canvas.height=Math.max(1,Math.floor(rect.height*ratio));
    const context=canvas.getContext('2d');
    if(!context)return;
    context.setTransform(ratio,0,0,ratio,0,0);
    context.lineCap='round';context.lineJoin='round';context.lineWidth=2.4;context.strokeStyle='#071126';
  },[contract?.id,contract?.status]);

  async function verifyPhone(event:FormEvent){
    event.preventDefault();
    try{
      setBusy(true);setError('');
      const response=await fetch(endpoint,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone}),
      });
      const result=await readResponse(response);
      if(!response.ok){setError(result.error||'연락처 확인 오류');return}
      await load();
    }catch(error){
      console.error('phone verify error',error);setError('연락처를 확인하지 못했습니다.');
    }finally{setBusy(false)}
  }

  function point(event:ReactPointerEvent<HTMLCanvasElement>){
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:event.clientX-rect.left,y:event.clientY-rect.top};
  }

  function pointerDown(event:ReactPointerEvent<HTMLCanvasElement>){
    const context=event.currentTarget.getContext('2d');if(!context)return;
    const next=point(event);drawingRef.current=true;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();context.moveTo(next.x,next.y);
  }

  function pointerMove(event:ReactPointerEvent<HTMLCanvasElement>){
    if(!drawingRef.current)return;
    const context=event.currentTarget.getContext('2d');if(!context)return;
    const next=point(event);context.lineTo(next.x,next.y);context.stroke();setDrawn(true);
  }

  function pointerUp(event:ReactPointerEvent<HTMLCanvasElement>){
    drawingRef.current=false;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clearSignature(){
    const canvas=canvasRef.current;if(!canvas)return;
    const context=canvas.getContext('2d');if(!context)return;
    context.save();context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.restore();
    setDrawn(false);
  }

  async function sign(){
    if(!contractConsent||!privacyConsent){setError('계약내용과 개인정보 처리 안내에 모두 동의해 주세요.');return}
    if(!drawn||!canvasRef.current){setError('서명란에 직접 서명해 주세요.');return}
    try{
      setBusy(true);setError('');
      const response=await fetch(`${endpoint}/sign`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          signer_name:signerName,
          contract_consent:contractConsent,
          privacy_consent:privacyConsent,
          signature_data_url:canvasRef.current.toDataURL('image/png'),
        }),
      });
      const result=await readResponse(response);
      if(!response.ok){setError(result.error||'전자서명 저장 오류');return}
      await load();
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(error){
      console.error('contract sign error',error);setError('전자서명을 저장하지 못했습니다.');
    }finally{setBusy(false)}
  }

  if(loading)return <main className="rc-contract-page"><div className="rc-contract-state"><b>계약서를 불러오는 중입니다.</b></div></main>;

  if(verificationRequired)return <main className="rc-contract-page"><section className="rc-contract-verify">
    <p>RECHAIR SECURE CONTRACT</p><h1>렌탈 계약서 확인</h1>
    <span>계약정보 보호를 위해 계약서에 등록된 휴대전화 번호를 입력해 주세요.</span>
    <div className="rc-contract-masked">등록 연락처 <b>{maskedPhone}</b></div>
    <form onSubmit={verifyPhone}><label><span>휴대전화 번호</span><input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="010-0000-0000" required/></label>{error&&<p className="rc-contract-error">{error}</p>}<button disabled={busy}>{busy?'확인 중…':'계약서 열기'}</button></form>
  </section></main>;

  if(!contract)return <main className="rc-contract-page"><div className="rc-contract-state error"><b>{error||'계약서를 열 수 없습니다.'}</b><span>담당자에게 계약 링크를 다시 요청해 주세요.</span></div></main>;

  const signed=['signed','superseded'].includes(contract.status);
  const customerEntityType=contract.document_snapshot?.customer?.entity_type||'individual';
  const isBusinessCustomer=customerEntityType!=='individual';
  return <main className="rc-contract-page">
    <div className="rc-contract-shell">
      <div className="rc-contract-topbar">
        <div><b>{signed?'전자서명 완료':'전자서명 요청'}</b><span>{contract.contract_no}</span></div>
        {signed&&<button type="button" onClick={()=>window.print()}>인쇄·PDF 저장</button>}
      </div>
      {contract.status==='superseded'&&<aside className="rc-contract-warning">변경계약서가 체결되어 현재 계약서는 이전 버전입니다.</aside>}
      {signed&&<aside className="rc-contract-success">계약이 정상적으로 체결되었습니다. 이 화면에서 계약서를 다시 확인하거나 PDF로 저장할 수 있습니다.</aside>}
      <RentalContractDocument snapshot={contract.document_snapshot} contract={contract}/>

      {!signed&&<section className="rc-contract-sign-form">
        <h2>계약 확인 및 전자서명</h2>
        <label className="rc-contract-check"><input type="checkbox" checked={contractConsent} onChange={e=>setContractConsent(e.target.checked)}/><span>월 렌탈료, 계약기간, 소유권, 중도해지, 회수 및 특약사항을 포함한 위 계약내용을 확인하고 동의합니다.{isBusinessCustomer?' 계약서에 표시된 사업자를 대표해 서명할 권한이 있음을 확인합니다.':''}</span></label>
        <label className="rc-contract-check"><input type="checkbox" checked={privacyConsent} onChange={e=>setPrivacyConsent(e.target.checked)}/><span>계약 체결·이행, 요금 정산 및 고객지원을 위한 필수 개인정보 처리에 동의합니다. 동의를 거부할 수 있으나 계약과 서비스 제공이 어려우며, 마케팅 동의는 포함하지 않습니다.</span></label>
        <label className="rc-contract-signer"><span>서명자 이름</span><input value={signerName} onChange={e=>setSignerName(e.target.value)} placeholder={isBusinessCustomer?'계약서에 지정된 서명자 이름':'개인 계약자 이름과 동일하게 입력'}/></label>
        <div className="rc-contract-canvas-head"><span>아래 칸에 직접 서명해 주세요.</span><button type="button" onClick={clearSignature}>다시 쓰기</button></div>
        <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/>
        {error&&<p className="rc-contract-error">{error}</p>}
        <button className="rc-contract-sign-button" type="button" disabled={busy} onClick={()=>void sign()}>{busy?'전자서명 저장 중…':'계약 동의 및 최종 서명'}</button>
        <small>서명 후 계약내용은 수정되지 않으며, 변경이 필요한 경우 담당자가 변경계약서를 새로 발급합니다.</small>
      </section>}
    </div>
  </main>;
}
