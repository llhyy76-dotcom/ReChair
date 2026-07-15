'use client';
import {useEffect,useState} from 'react';

const STATES=['배정대기','배정완료','이동중','방문중','완료','취소'];

export default function AdminScheduleBoard(){
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [rows,setRows]=useState<any[]>([]);
  const [editing,setEditing]=useState<any>(null);
  const [message,setMessage]=useState('');

  async function load(){
    const r=await fetch('/api/admin/schedule?date='+date,{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'조회 오류');return;}
    setRows(j.data||[]);
  }
  useEffect(()=>{load()},[date]);

  async function save(){
    if(!editing)return;
    const r=await fetch('/api/admin/schedule/'+editing.id,{
      method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(editing)
    });
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'저장 오류');return;}
    setMessage('일정이 저장되었습니다.');
    setEditing(null);load();
  }

  return <div className="schedule">
    <header><div><p>RECHAIR ADMIN</p><h1>AS 일정 관리</h1><span>기사 배정과 방문 진행상태를 관리합니다.</span></div>
    <nav><a href="/admin/dashboard">대시보드</a><a href="/admin/consultations">상담 CRM</a></nav></header>

    <section className="controls"><label>조회일<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button onClick={load}>새로고침</button></section>
    {message&&<aside>{message}</aside>}

    <section className="summary">
      <article><small>전체</small><strong>{rows.length}</strong></article>
      {STATES.slice(0,5).map(s=><article key={s}><small>{s}</small><strong>{rows.filter(r=>r.status===s).length}</strong></article>)}
    </section>

    <section className="board">
      {rows.length===0?<p className="empty">등록된 일정이 없습니다.</p>:rows.map(r=><button onClick={()=>setEditing(r)} key={r.id}>
        <time>{new Date(r.scheduled_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time>
        <div><b>{r.customer_name}</b><span>{r.region||'지역 미입력'} · {r.service_type||'서비스 미입력'}</span><em>{r.address||'주소 미입력'}</em></div>
        <div><strong>{r.assignee||'미배정'}</strong><small>{r.status}</small></div>
      </button>)}
    </section>

    {editing&&<div className="backdrop" onClick={()=>setEditing(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <h2>{editing.customer_name}</h2>
      <div className="grid">
        <label>방문일시<input type="datetime-local" value={editing.scheduled_at.slice(0,16)} onChange={e=>setEditing({...editing,scheduled_at:e.target.value})}/></label>
        <label>담당자<input value={editing.assignee||''} onChange={e=>setEditing({...editing,assignee:e.target.value})}/></label>
        <label>소요시간<input type="number" value={editing.duration_minutes||60} onChange={e=>setEditing({...editing,duration_minutes:Number(e.target.value)})}/></label>
        <label>상태<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>{STATES.map(s=><option key={s}>{s}</option>)}</select></label>
      </div>
      <label>주소<input value={editing.address||''} onChange={e=>setEditing({...editing,address:e.target.value})}/></label>
      <label>메모<textarea value={editing.memo||''} onChange={e=>setEditing({...editing,memo:e.target.value})}/></label>
      <footer><a href={'tel:'+(editing.phone||'')}>전화</a><button onClick={save}>저장</button></footer>
    </div></div>}
  </div>
}
