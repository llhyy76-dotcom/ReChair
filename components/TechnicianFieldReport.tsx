'use client';

import {useEffect,useRef,useState} from 'react';

type Photo={id:string;photo_type:string;photo_url:string};
type Report={id:string;customer_name?:string;service_type?:string;symptom_text?:string|null;action_text?:string|null;replaced_parts?:string|null;customer_confirmation?:string|null;customer_signature_url?:string|null;service_schedule_photos?:Photo[]};
const photoTypes=[['front','제품 정면'],['side','제품 측면'],['label','제품 라벨'],['after','작업 후'],['part','교체 부품'],['receipt','영수증']] as const;

export default function TechnicianFieldReport({scheduleId,onClose}:{scheduleId:string,onClose:()=>void}){
  const [report,setReport]=useState<Report|null>(null);
  const [symptom,setSymptom]=useState('');
  const [action,setAction]=useState('');
  const [parts,setParts]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawingRef=useRef(false);
  async function load(){
    const r=await fetch(`/api/technician/assignments/${scheduleId}/report`,{cache:'no-store'});const j=await r.json();
    if(!r.ok){setMessage(j.error||'작업보고 조회 오류');return}
    setReport(j.data);setSymptom(j.data.symptom_text||'');setAction(j.data.action_text||'');setParts(j.data.replaced_parts||'');setConfirmation(j.data.customer_confirmation||'');
  }
  useEffect(()=>{load()},[scheduleId]);
  async function saveReport(){
    setSaving(true);const r=await fetch(`/api/technician/assignments/${scheduleId}/report`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({symptom_text:symptom,action_text:action,replaced_parts:parts,customer_confirmation:confirmation})});const j=await r.json();setSaving(false);setMessage(r.ok?'작업보고가 저장되었습니다.':j.error||'저장 오류');if(r.ok)load();
  }
  async function uploadPhoto(type:string,file?:File){
    if(!file)return;const form=new FormData();form.append('photo_type',type);form.append('file',file);const r=await fetch(`/api/technician/assignments/${scheduleId}/report`,{method:'POST',body:form});const j=await r.json();setMessage(r.ok?'사진이 등록되었습니다.':j.error||'사진 업로드 오류');if(r.ok)load();
  }
  function point(e:React.PointerEvent<HTMLCanvasElement>){const c=e.currentTarget,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*(c.width/r.width),y:(e.clientY-r.top)*(c.height/r.height)}}
  function startDraw(e:React.PointerEvent<HTMLCanvasElement>){drawingRef.current=true;const c=e.currentTarget;c.setPointerCapture(e.pointerId);const ctx=c.getContext('2d'),p=point(e);ctx?.beginPath();ctx?.moveTo(p.x,p.y)}
  function draw(e:React.PointerEvent<HTMLCanvasElement>){if(!drawingRef.current)return;const ctx=e.currentTarget.getContext('2d'),p=point(e);if(!ctx)return;ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle='#071126';ctx.lineTo(p.x,p.y);ctx.stroke()}
  function stopDraw(){drawingRef.current=false}
  function clearSignature(){const c=canvasRef.current;if(c)c.getContext('2d')?.clearRect(0,0,c.width,c.height)}
  async function saveSignature(){const c=canvasRef.current;if(!c)return;const r=await fetch(`/api/technician/assignments/${scheduleId}/signature`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signature_data_url:c.toDataURL('image/png')})});const j=await r.json();setMessage(r.ok?'고객 서명이 저장되었습니다.':j.error||'서명 저장 오류');if(r.ok)load()}
  const photos=report?.service_schedule_photos||[];
  return <div className="field-report-backdrop" onClick={onClose}><div className="field-report-panel" onClick={e=>e.stopPropagation()}><header><div><p>FIELD SERVICE REPORT</p><h2>{report?.customer_name||'현장 작업보고'}</h2><span>{report?.service_type||'서비스 정보 없음'}</span></div><button onClick={onClose}>×</button></header>{message&&<aside>{message}</aside>}<section className="report-form-grid"><label><span>고객 증상</span><textarea value={symptom} onChange={e=>setSymptom(e.target.value)}/></label><label><span>조치 내용</span><textarea value={action} onChange={e=>setAction(e.target.value)}/></label><label><span>교체 부품</span><textarea value={parts} onChange={e=>setParts(e.target.value)}/></label><label><span>고객 확인사항</span><textarea value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></section><button className="primary" onClick={saveReport} disabled={saving}>{saving?'저장 중':'작업보고 저장'}</button><section className="report-photo-section"><h3>현장 사진</h3><div className="report-photo-grid">{photoTypes.map(([type,label])=>{const found=photos.find(p=>p.photo_type===type);return <label key={type} className="photo-slot"><b>{label}</b>{found?<a href={found.photo_url} target="_blank"><img src={found.photo_url} alt={label}/></a>:<span>사진 없음</span>}<input type="file" accept="image/*" capture="environment" onChange={e=>uploadPhoto(type,e.target.files?.[0])}/></label>})}</div></section><section className="signature-section"><div><h3>고객 서명</h3><p>작업내용을 확인한 고객이 아래 칸에 서명합니다.</p></div>{report?.customer_signature_url?<a href={report.customer_signature_url} target="_blank" className="saved-signature"><img src={report.customer_signature_url} alt="고객 서명"/></a>:<><canvas ref={canvasRef} width={900} height={260} onPointerDown={startDraw} onPointerMove={draw} onPointerUp={stopDraw} onPointerCancel={stopDraw}/><div className="signature-actions"><button onClick={clearSignature}>다시 쓰기</button><button className="primary" onClick={saveSignature}>서명 저장</button></div></>}</section></div></div>
}
