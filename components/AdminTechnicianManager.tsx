'use client';

import {useEffect,useMemo,useState} from 'react';

type Technician={
  id:string;
  name:string;
  phone?:string|null;
  region?:string|null;
  team_name?:string|null;
  daily_capacity:number;
  is_active:boolean;
  memo?:string|null;
  created_at?:string|null;
};

const EMPTY={
  name:'',
  phone:'',
  region:'',
  team_name:'',
  daily_capacity:5,
  is_active:true,
  memo:'',
};

export default function AdminTechnicianManager(){
  const [rows,setRows]=useState<Technician[]>([]);
  const [editing,setEditing]=useState<any>(null);
  const [form,setForm]=useState<any>(EMPTY);
  const [message,setMessage]=useState('');
  const [keyword,setKeyword]=useState('');

  async function load(){
    const r=await fetch('/api/admin/technicians',{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'기사 조회 오류');return;}
    setRows(j.data||[]);
  }

  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{
    const q=keyword.trim().toLowerCase();
    if(!q)return rows;
    return rows.filter(r=>
      [r.name,r.phone,r.region,r.team_name,r.memo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  },[rows,keyword]);

  async function create(){
    if(!form.name.trim()){
      setMessage('기사명 또는 팀명을 입력해 주세요.');
      return;
    }
    const r=await fetch('/api/admin/technicians',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(form),
    });
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'기사 등록 오류');return;}
    setMessage('기사가 등록되었습니다.');
    setForm({...EMPTY});
    await load();
  }

  async function save(){
    if(!editing)return;
    const r=await fetch('/api/admin/technicians/'+editing.id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(editing),
    });
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'기사 저장 오류');return;}
    setMessage('기사 정보가 저장되었습니다.');
    setEditing(null);
    await load();
  }

  async function toggle(item:Technician){
    const r=await fetch('/api/admin/technicians/'+item.id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...item,is_active:!item.is_active}),
    });
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'상태 변경 오류');return;}
    await load();
  }

  const activeCount=rows.filter(r=>r.is_active).length;
  const totalCapacity=rows.filter(r=>r.is_active).reduce((s,r)=>s+Number(r.daily_capacity||0),0);

  return <div className="tm">
    <header>
      <div>
        <p>RECHAIR ADMIN</p>
        <h1>기사·팀 관리</h1>
        <span>담당지역, 일일 처리한도, 활성 상태를 관리합니다.</span>
      </div>
      <nav>
        <a href="/admin/dashboard">대시보드</a>
        <a href="/admin/schedule">AS 캘린더</a>
        <a href="/admin/consultations">상담 CRM</a>
      </nav>
    </header>

    {message&&<aside>{message}</aside>}

    <section className="tm-summary">
      <article><small>전체 기사·팀</small><strong>{rows.length}</strong></article>
      <article><small>활성</small><strong>{activeCount}</strong></article>
      <article><small>비활성</small><strong>{rows.length-activeCount}</strong></article>
      <article className="dark"><small>일일 총 처리한도</small><strong>{totalCapacity}건</strong></article>
    </section>

    <section className="tm-layout">
      <article className="tm-form">
        <div className="section-title">
          <p>NEW TECHNICIAN</p>
          <h2>기사·팀 등록</h2>
        </div>

        <label><span>기사명 또는 팀명</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label><span>연락처</span><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label><span>담당지역</span><input value={form.region} onChange={e=>setForm({...form,region:e.target.value})} placeholder="예: 고양·파주"/></label>
        <label><span>소속팀</span><input value={form.team_name} onChange={e=>setForm({...form,team_name:e.target.value})}/></label>
        <label><span>일일 처리한도</span><input type="number" min="1" max="20" value={form.daily_capacity} onChange={e=>setForm({...form,daily_capacity:Number(e.target.value)})}/></label>
        <label><span>메모</span><textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label>

        <button onClick={create}>기사·팀 등록</button>
      </article>

      <article className="tm-list">
        <div className="tm-list-head">
          <div className="section-title">
            <p>TECHNICIANS</p>
            <h2>등록 현황</h2>
          </div>
          <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="이름·지역 검색"/>
        </div>

        <div className="tm-table">
          {filtered.map(item=><div className={!item.is_active?'off':''} key={item.id}>
            <section>
              <b>{item.name}</b>
              <span>{item.team_name||'소속팀 미입력'}</span>
              <em>{item.region||'담당지역 미입력'}</em>
            </section>
            <section>
              <small>일일 처리한도</small>
              <strong>{item.daily_capacity||5}건</strong>
            </section>
            <section>
              <small>연락처</small>
              <strong>{item.phone||'-'}</strong>
            </section>
            <section className="actions">
              <button onClick={()=>setEditing(item)}>수정</button>
              <button className={item.is_active?'stop':'start'} onClick={()=>toggle(item)}>
                {item.is_active?'비활성':'활성화'}
              </button>
            </section>
          </div>)}
        </div>
      </article>
    </section>

    {editing&&<div className="tm-backdrop" onClick={()=>setEditing(null)}>
      <div className="tm-modal" onClick={e=>e.stopPropagation()}>
        <div className="tm-modal-head">
          <div><p>EDIT TECHNICIAN</p><h2>{editing.name}</h2></div>
          <button onClick={()=>setEditing(null)}>×</button>
        </div>

        <div className="tm-grid">
          <label><span>이름</span><input value={editing.name||''} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
          <label><span>연락처</span><input value={editing.phone||''} onChange={e=>setEditing({...editing,phone:e.target.value})}/></label>
          <label><span>담당지역</span><input value={editing.region||''} onChange={e=>setEditing({...editing,region:e.target.value})}/></label>
          <label><span>소속팀</span><input value={editing.team_name||''} onChange={e=>setEditing({...editing,team_name:e.target.value})}/></label>
          <label><span>일일 처리한도</span><input type="number" min="1" max="20" value={editing.daily_capacity||5} onChange={e=>setEditing({...editing,daily_capacity:Number(e.target.value)})}/></label>
          <label><span>활성 상태</span><select value={editing.is_active?'활성':'비활성'} onChange={e=>setEditing({...editing,is_active:e.target.value==='활성'})}><option>활성</option><option>비활성</option></select></label>
        </div>

        <label className="tm-full"><span>메모</span><textarea value={editing.memo||''} onChange={e=>setEditing({...editing,memo:e.target.value})}/></label>

        <footer>
          <button className="cancel" onClick={()=>setEditing(null)}>취소</button>
          <button onClick={save}>저장</button>
        </footer>
      </div>
    </div>}
  </div>
}
