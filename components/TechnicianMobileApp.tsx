'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';

type Assignment={
  id:string;
  consultation_id?:string|null;
  customer_name:string;
  phone?:string|null;
  address?:string|null;
  region?:string|null;
  service_type?:string|null;
  assignee?:string|null;
  scheduled_at:string;
  duration_minutes:number;
  status:string;
  memo?:string|null;
  completion_note?:string|null;
  completion_photo_urls?:string[]|null;
};

const iso=(d=new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const time=(value:string) =>
  new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});

export default function TechnicianMobileApp(){
  const router=useRouter();
  const [date,setDate]=useState(iso());
  const [technician,setTechnician]=useState<any>(null);
  const [items,setItems]=useState<Assignment[]>([]);
  const [message,setMessage]=useState('');
  const [selected,setSelected]=useState<Assignment|null>(null);
  const [note,setNote]=useState('');
  const [files,setFiles]=useState<File[]>([]);
  const [saving,setSaving]=useState(false);
  const [checking,setChecking]=useState(true);

  async function checkSession(){
    const r=await fetch('/api/technician/me',{cache:'no-store'});
    const j=await r.json();

    if(r.status===401){
      router.replace('/technician/login');
      return;
    }

    if(!r.ok){
      setMessage(j.error||'로그인 확인 오류');
      setChecking(false);
      return;
    }

    setTechnician(j.data);
    setChecking(false);
  }

  async function loadAssignments(){
    if(!technician)return;

    const p=new URLSearchParams({date});
    const r=await fetch('/api/technician/assignments?'+p.toString(),{cache:'no-store'});
    const j=await r.json();

    if(r.status===401){
      router.replace('/technician/login');
      return;
    }

    if(!r.ok){
      setMessage(j.error||'일정 조회 오류');
      return;
    }

    setItems(j.data||[]);
  }

  useEffect(()=>{checkSession()},[]);
  useEffect(() => {
  if (technician?.name) loadAssignments();
}, [date, technician?.name]);

  const summary=useMemo(()=>({
    total:items.length,
    waiting:items.filter(i=>['배정대기','배정완료'].includes(i.status)).length,
    active:items.filter(i=>['이동중','방문중'].includes(i.status)).length,
    done:items.filter(i=>i.status==='완료').length,
  }),[items]);

  async function logout(){
    await fetch('/api/technician/auth/logout',{method:'POST'});
    router.replace('/technician/login');
    router.refresh();
  }

  async function updateStatus(item:Assignment,status:string){
    const r=await fetch('/api/technician/assignments/'+item.id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({status}),
    });
    const j=await r.json();

    if(r.status===401){
      router.replace('/technician/login');
      return;
    }

    if(!r.ok){
      setMessage(j.error||'상태 변경 오류');
      return;
    }

    setMessage(`${item.customer_name} 일정이 '${status}' 상태로 변경되었습니다.`);
    await loadAssignments();
  }

  function openComplete(item:Assignment){
    setSelected(item);
    setNote(item.completion_note||'');
    setFiles([]);
  }

  async function complete(){
    if(!selected)return;

    setSaving(true);
    let urls:string[]=[];

    if(files.length){
      const form=new FormData();
      files.forEach(file=>form.append('files',file));

      const uploadRes=await fetch(`/api/technician/assignments/${selected.id}/photos`,{
        method:'POST',
        body:form,
      });
      const uploadJson=await uploadRes.json();

      if(!uploadRes.ok){
        setSaving(false);
        setMessage(uploadJson.error||'사진 업로드 오류');
        return;
      }

      urls=uploadJson.data||[];
    }

    const r=await fetch('/api/technician/assignments/'+selected.id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        status:'완료',
        completion_note:note,
        completion_photo_urls:[
          ...(selected.completion_photo_urls||[]),
          ...urls,
        ],
      }),
    });
    const j=await r.json();
    setSaving(false);

    if(!r.ok){
      setMessage(j.error||'완료 처리 오류');
      return;
    }

    setMessage('현장 완료보고가 저장되었습니다.');
    setSelected(null);
    await loadAssignments();
  }

  const mapUrl=(address?:string|null) =>
    `https://map.kakao.com/link/search/${encodeURIComponent(address||'')}`;

  if(checking){
    return <div className="tech-mobile-loading">로그인 상태를 확인하고 있습니다.</div>;
  }

  return <div className="tech-mobile">
    <header>
      <div>
        <p>RECHAIR FIELD</p>
        <h1>오늘의 방문 일정</h1>
        <span>{technician?.name} 전용 일정입니다.</span>
      </div>

      <div className="field-account">
        <b>{technician?.name}</b>
        <button onClick={logout}>로그아웃</button>
      </div>
    </header>

    <section className="mobile-controls auth-controls">
      <label>
        <span>일자</span>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </label>

      <button onClick={loadAssignments}>새로고침</button>
    </section>

    {message&&<aside>{message}</aside>}

    <section className="mobile-summary">
      <article><small>전체</small><strong>{summary.total}</strong></article>
      <article><small>대기</small><strong>{summary.waiting}</strong></article>
      <article><small>진행중</small><strong>{summary.active}</strong></article>
      <article className="dark"><small>완료</small><strong>{summary.done}</strong></article>
    </section>

    <section className="assignment-list">
      {items.length===0?<div className="empty">
        <b>배정된 일정이 없습니다.</b>
        <p>관리자가 {technician?.name}에 일정을 배정하면 표시됩니다.</p>
      </div>:items.map((item,index)=><article key={item.id}>
        <div className="visit-order">{index+1}</div>

        <div className="visit-main">
          <div className="visit-head">
            <time>{time(item.scheduled_at)}</time>
            <span className={'status '+item.status}>{item.status}</span>
          </div>

          <h2>{item.customer_name}</h2>
          <p>{item.service_type||'서비스 미입력'} · 예상 {item.duration_minutes||60}분</p>
          <address>{item.address||item.region||'주소 미입력'}</address>
          {item.memo&&<blockquote>{item.memo}</blockquote>}

          <div className="quick-links">
            <a href={'tel:'+(item.phone||'')}>고객 전화</a>
            <a href={mapUrl(item.address||item.region)} target="_blank">지도 열기</a>
          </div>
        </div>

        <div className="status-actions">
          {['배정대기','배정완료'].includes(item.status)&&
            <button onClick={()=>updateStatus(item,'이동중')}>이동 시작</button>}

          {item.status==='이동중'&&
            <button onClick={()=>updateStatus(item,'방문중')}>현장 도착</button>}

          {item.status==='방문중'&&
            <button className="complete" onClick={()=>openComplete(item)}>완료 보고</button>}

          {item.status==='완료'&&
            <button className="done" onClick={()=>openComplete(item)}>완료 내용 보기</button>}
        </div>
      </article>)}
    </section>

    {selected&&<div className="complete-backdrop" onClick={()=>setSelected(null)}>
      <div className="complete-modal" onClick={e=>e.stopPropagation()}>
        <div className="complete-head">
          <div>
            <p>FIELD REPORT</p>
            <h2>{selected.customer_name}</h2>
            <span>{selected.service_type||'서비스 미입력'}</span>
          </div>
          <button onClick={()=>setSelected(null)}>×</button>
        </div>

        <label>
          <span>완료 내용</span>
          <textarea
            value={note}
            onChange={e=>setNote(e.target.value)}
            placeholder="점검 내용, 조치 부품, 고객 안내사항 등을 입력하세요."
          />
        </label>

        <label>
          <span>현장 사진</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,4))}
          />
          <small>최대 4장까지 등록할 수 있습니다.</small>
        </label>

        {(selected.completion_photo_urls||[]).length>0&&<div className="photo-grid">
          {(selected.completion_photo_urls||[]).map((url,i)=>
            <a href={url} target="_blank" key={url+i}>
              <img src={url} alt={`완료사진 ${i+1}`}/>
            </a>
          )}
        </div>}

        <footer>
          <button className="cancel" onClick={()=>setSelected(null)}>닫기</button>
          {selected.status!=='완료'&&
            <button onClick={complete} disabled={saving}>
              {saving?'저장 중':'완료 저장'}
            </button>}
        </footer>
      </div>
    </div>}
  </div>
}
