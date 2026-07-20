'use client';
import {useEffect,useMemo,useState} from 'react';

export default function AdminSecurityAudit(){
  const [rows,setRows]=useState<any[]>([]);
  const [message,setMessage]=useState('');

  async function load(){
    const r=await fetch('/api/admin/security/audit',{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'보안기록 조회 오류');return;}
    setRows(j.data||[]);
  }
  useEffect(()=>{load()},[]);

  const s=useMemo(()=>({
    total:rows.length,
    success:rows.filter(r=>r.result==='success').length,
    fail:rows.filter(r=>r.result==='fail').length,
    logout:rows.filter(r=>r.action==='logout').length
  }),[rows]);

  return <div className="security-audit">
    <header>
      <div><p>RECHAIR ADMIN</p><h1>보안 및 접속 기록</h1><span>관리자 로그인과 로그아웃 이력을 확인합니다.</span></div>
      <nav><a href="/admin/dashboard">대시보드</a><a href="/admin/technician-access">기사 접근권한</a></nav>
    </header>
    {message&&<aside>{message}</aside>}
    <section className="security-summary">
      <article><small>전체</small><strong>{s.total}</strong></article>
      <article><small>성공</small><strong>{s.success}</strong></article>
      <article><small>실패</small><strong>{s.fail}</strong></article>
      <article className="dark"><small>로그아웃</small><strong>{s.logout}</strong></article>
    </section>
    <section className="security-table">
      <div className="security-toolbar"><div><p>SECURITY AUDIT</p><h2>최근 접속 기록</h2></div><button onClick={load}>새로고침</button></div>
      {rows.length===0?<div className="empty">보안 기록이 없습니다.</div>:rows.map(r=><article key={r.id}>
        <div><span className={'result '+r.result}>{r.result}</span><b>{r.action}</b></div>
        <div><small>접속 시각</small><strong>{new Date(r.created_at).toLocaleString('ko-KR')}</strong></div>
        <div><small>IP</small><strong>{r.ip_address||'-'}</strong></div>
        <div><small>기기</small><strong title={r.user_agent||''}>{r.user_agent||'-'}</strong></div>
      </article>)}
    </section>
  </div>
}
