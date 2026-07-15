'use client';

import {useEffect,useMemo,useState} from 'react';

type Technician={
  id:string;
  name:string;
  is_active:boolean;
};

type RouteItem={
  id:string;
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
  route_order:number;
};

const iso=(d=new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const fmtTime=(value:string) =>
  new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});

export default function AdminRoutePlanner(){
  const [date,setDate]=useState(iso());
  const [technicians,setTechnicians]=useState<Technician[]>([]);
  const [technician,setTechnician]=useState('');
  const [rows,setRows]=useState<RouteItem[]>([]);
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);

  async function loadTechnicians(){
    const r=await fetch('/api/admin/technicians',{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'기사 조회 오류');return;}
    const active=(j.data||[]).filter((t:Technician)=>t.is_active);
    setTechnicians(active);
    if(!technician && active.length)setTechnician(active[0].name);
  }

  async function loadRoutes(name=technician){
    if(!name)return;
    const p=new URLSearchParams({date,assignee:name});
    const r=await fetch('/api/admin/routes?'+p.toString(),{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'동선 조회 오류');return;}
    setRows(j.data||[]);
  }

  useEffect(()=>{loadTechnicians()},[]);
  useEffect(()=>{if(technician)loadRoutes()},[date,technician]);

  const totals=useMemo(()=>({
    count:rows.length,
    minutes:rows.reduce((s,r)=>s+Number(r.duration_minutes||0),0),
    completed:rows.filter(r=>r.status==='완료').length,
    remaining:rows.filter(r=>r.status!=='완료'&&r.status!=='취소').length,
  }),[rows]);

  function move(index:number,direction:-1|1){
    const target=index+direction;
    if(target<0||target>=rows.length)return;

    const copy=[...rows];
    [copy[index],copy[target]]=[copy[target],copy[index]];
    setRows(copy.map((r,i)=>({...r,route_order:i+1})));
  }

  async function saveOrder(){
    setSaving(true);
    const r=await fetch('/api/admin/routes/reorder',{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({items:rows.map((r,i)=>({id:r.id,route_order:i+1}))}),
    });
    const j=await r.json();
    setSaving(false);

    if(!r.ok){setMessage(j.error||'동선 저장 오류');return;}
    setMessage('방문 순서가 저장되었습니다.');
    await loadRoutes();
  }

  function mapUrl(address?:string|null){
    const q=encodeURIComponent(address||'');
    return `https://map.kakao.com/link/search/${q}`;
  }

  async function copyPlan(){
    const text=[
      `[${date} ${technician} 방문 일정]`,
      ...rows.map((r,i)=>
        `${i+1}. ${fmtTime(r.scheduled_at)} ${r.customer_name} / ${r.address||r.region||'주소 미입력'} / ${r.service_type||'서비스 미입력'}`
      )
    ].join('\n');

    try{
      await navigator.clipboard.writeText(text);
      setMessage('오늘 동선이 클립보드에 복사되었습니다.');
    }catch{
      setMessage('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.');
    }
  }

  return <div className="route">
    <header>
      <div>
        <p>RECHAIR ADMIN</p>
        <h1>기사 방문 동선</h1>
        <span>기사별 하루 방문 순서를 정리하고 지도에서 주소를 확인합니다.</span>
      </div>
      <nav>
        <a href="/admin/dashboard">대시보드</a>
        <a href="/admin/dispatch">자동배정</a>
        <a href="/admin/schedule">AS 캘린더</a>
      </nav>
    </header>

    {message&&<aside>{message}</aside>}

    <section className="route-controls">
      <label>
        <span>방문일</span>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </label>

      <label>
        <span>기사·팀</span>
        <select value={technician} onChange={e=>setTechnician(e.target.value)}>
          {technicians.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </label>

      <button onClick={()=>loadRoutes()}>새로고침</button>
      <button className="copy" onClick={copyPlan}>동선 복사</button>
      <button className="save" onClick={saveOrder} disabled={saving}>
        {saving?'저장 중':'방문 순서 저장'}
      </button>
    </section>

    <section className="route-summary">
      <article><small>방문 건수</small><strong>{totals.count}건</strong></article>
      <article><small>예상 작업시간</small><strong>{Math.floor(totals.minutes/60)}시간 {totals.minutes%60}분</strong></article>
      <article><small>완료</small><strong>{totals.completed}건</strong></article>
      <article className="dark"><small>남은 일정</small><strong>{totals.remaining}건</strong></article>
    </section>

    <section className="route-board">
      <div className="route-head">
        <div>
          <p>DAILY ROUTE</p>
          <h2>{technician||'기사 미선택'}</h2>
        </div>
        <span>{date}</span>
      </div>

      {rows.length===0?<p className="empty">선택한 날짜에 배정된 일정이 없습니다.</p>:
        <div className="route-list">
          {rows.map((item,index)=><article key={item.id}>
            <div className="order">{index+1}</div>

            <div className="visit-info">
              <div className="visit-title">
                <time>{fmtTime(item.scheduled_at)}</time>
                <b>{item.customer_name}</b>
                <small>{item.status}</small>
              </div>
              <span>{item.service_type||'서비스 미입력'} · 예상 {item.duration_minutes||60}분</span>
              <em>{item.address||item.region||'주소 미입력'}</em>
              {item.memo&&<p>{item.memo}</p>}
            </div>

            <div className="route-actions">
              <button onClick={()=>move(index,-1)} disabled={index===0}>↑</button>
              <button onClick={()=>move(index,1)} disabled={index===rows.length-1}>↓</button>
              <a href={mapUrl(item.address||item.region)} target="_blank">지도</a>
              <a href={'tel:'+(item.phone||'')}>전화</a>
            </div>
          </article>)}
        </div>
      }
    </section>

    <section className="route-guide">
      <h3>운영 방법</h3>
      <p>위·아래 버튼으로 방문 순서를 정한 뒤 ‘방문 순서 저장’을 누릅니다. 주소의 ‘지도’ 버튼을 누르면 카카오맵 검색 화면이 열립니다.</p>
    </section>
  </div>
}
