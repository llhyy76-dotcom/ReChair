'use client';
import {useEffect,useMemo,useState} from 'react';

export default function AdminTechnicianAccess(){
  const [rows,setRows]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [sessions,setSessions]=useState<any[]>([]);
  const [pin,setPin]=useState('');
  const [message,setMessage]=useState('');

  async function load(){
    const r=await fetch('/api/admin/technician-access',{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'조회 오류');return}
    setRows(j.data||[]);
  }
  useEffect(()=>{load()},[]);

  async function open(item:any){
    setSelected(item); setPin('');
    const r=await fetch(`/api/admin/technician-access/${item.id}/sessions`,{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'세션 조회 오류');return}
    setSessions(j.data||[]);
  }

  async function resetPin(){
    if(!selected||!/^[0-9]{4,8}$/.test(pin)){setMessage('PIN은 숫자 4~8자리입니다.');return}
    const r=await fetch(`/api/admin/technician-access/${selected.id}/reset-pin`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})
    });
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'PIN 변경 오류');return}
    setMessage(selected.name+' PIN 변경 및 기존 세션 종료 완료');
    setSessions([]); setPin(''); load();
  }

  async function revoke(id:string){
    const r=await fetch(`/api/admin/technician-access/sessions/${id}`,{method:'DELETE'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'세션 종료 오류');return}
    setSessions(v=>v.filter(s=>s.id!==id)); load();
  }

  const s=useMemo(()=>({
    total:rows.length,
    pin:rows.filter(r=>r.pin_registered).length,
    sessions:rows.reduce((a,r)=>a+Number(r.active_sessions||0),0),
    inactive:rows.filter(r=>!r.is_active).length
  }),[rows]);

  const fmt=(v?:string)=>v?new Date(v).toLocaleString('ko-KR'):'-';

  return <div className="access">
    <header><div><p>RECHAIR ADMIN</p><h1>기사 접근권한</h1><span>PIN과 로그인 세션을 관리합니다.</span></div>
    <nav><a href="/admin/dashboard">대시보드</a><a href="/admin/technicians">기사 관리</a><a href="/admin/schedule">AS 캘린더</a></nav></header>
    {message&&<aside>{message}</aside>}
    <section className="summary">
      <article><small>전체</small><strong>{s.total}</strong></article>
      <article><small>PIN 등록</small><strong>{s.pin}</strong></article>
      <article><small>활성 로그인</small><strong>{s.sessions}</strong></article>
      <article className="dark"><small>비활성</small><strong>{s.inactive}</strong></article>
    </section>
    <section className="table">
      <div className="title"><p>TECHNICIAN ACCESS</p><h2>접근권한 현황</h2></div>
      {rows.map(r=><article key={r.id} className={!r.is_active?'off':''}>
        <div><b>{r.name}</b><span>{r.team_name||r.region||'-'}</span></div>
        <div><small>PIN</small><strong>{r.pin_registered?'등록됨':'미등록'}</strong></div>
        <div><small>최근 변경</small><strong>{fmt(r.pin_updated_at)}</strong></div>
        <div><small>세션</small><strong>{r.active_sessions}개</strong></div>
        <button onClick={()=>open(r)}>관리</button>
      </article>)}
    </section>
    {selected&&<div className="backdrop" onClick={()=>setSelected(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><p>ACCESS CONTROL</p><h2>{selected.name}</h2></div><button onClick={()=>setSelected(null)}>×</button></div>
      <section className="pin-box"><h3>PIN 재설정</h3><p>변경 시 기존 로그인은 모두 종료됩니다.</p>
        <div><input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))} type="password" inputMode="numeric" placeholder="새 PIN 4~8자리"/><button onClick={resetPin}>PIN 변경</button></div>
      </section>
      <section className="session-box"><div><h3>활성 로그인 세션</h3><span>{sessions.length}개</span></div>
        {sessions.length===0?<p className="empty">활성 세션이 없습니다.</p>:sessions.map(x=><article key={x.id}><div><b>{fmt(x.created_at)}</b><span>만료 {fmt(x.expires_at)}</span><em>{x.user_agent||'기기 정보 없음'}</em></div><button onClick={()=>revoke(x.id)}>강제 로그아웃</button></article>)}
      </section>
    </div></div>}
  </div>
}
