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
  today_count?:number;
  scheduled_count?:number;
  active_count?:number;
  review_pending_count?:number;
  approved_count?:number;
  rejected_count?:number;
  remaining_capacity?:number;
  utilization_percent?:number;
  availability_type?:string;
  availability_start_time?:string|null;
  availability_end_time?:string|null;
  availability_note?:string|null;
};

type Summary={
  date:string;
  total:number;
  active_technicians:number;
  available_technicians:number;
  unavailable_technicians:number;
  total_capacity:number;
  assigned_count:number;
  remaining_capacity:number;
  review_pending_count:number;
  rejected_count:number;
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

function todayKst(){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(new Date());
}

function availabilityLabel(item:Technician){
  if(!item.is_active)return '비활성';
  return item.availability_type||'기본근무';
}

export default function AdminTechnicianManager(){
  const [rows,setRows]=useState<Technician[]>([]);
  const [summary,setSummary]=useState<Summary|null>(null);
  const [editing,setEditing]=useState<any>(null);
  const [form,setForm]=useState<any>(EMPTY);
  const [message,setMessage]=useState('');
  const [keyword,setKeyword]=useState('');
  const [date,setDate]=useState(todayKst());
  const [statusFilter,setStatusFilter]=useState('전체');
  const [loading,setLoading]=useState(false);

  async function load(){
    try{
      setLoading(true);
      const r=await fetch(
        '/api/admin/technicians/overview?date='+encodeURIComponent(date),
        {cache:'no-store'}
      );
      const j=await r.json();
      if(!r.ok){setMessage(j.error||'기사 운영현황 조회 오류');return;}
      setRows(j.data||[]);
      setSummary(j.summary||null);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load()},[date]);

  const filtered=useMemo(()=>{
    const q=keyword.trim().toLowerCase();
    return rows.filter(row=>{
      const matchesKeyword=!q||[
        row.name,row.phone,row.region,row.team_name,row.memo,
      ].filter(Boolean).join(' ').toLowerCase().includes(q);

      if(!matchesKeyword)return false;
      if(statusFilter==='전체')return true;
      if(statusFilter==='활성')return row.is_active;
      if(statusFilter==='비활성')return !row.is_active;
      if(statusFilter==='근무가능'){
        return row.is_active&&['근무','기본근무'].includes(availabilityLabel(row));
      }
      if(statusFilter==='휴무·연차·교육'){
        return row.is_active&&!['근무','기본근무'].includes(availabilityLabel(row));
      }
      if(statusFilter==='한도초과'){
        return Number(row.today_count||0)>=Number(row.daily_capacity||5);
      }
      return true;
    });
  },[rows,keyword,statusFilter]);

  async function create(){
    if(!form.name.trim()){
      setMessage('기사명을 입력해 주세요.');
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
    setMessage(item.is_active?'기사를 비활성화했습니다.':'기사를 활성화했습니다.');
    await load();
  }

  return <div className="tm">
    <header className="tm-hero">
      <div>
        <p>RECHAIR OMS · TECHNICIAN CONTROL</p>
        <h1>기사 운영센터</h1>
        <span>기사 정보, 담당지역, 처리한도, 당일 업무량과 근무상태를 한 화면에서 관리합니다.</span>
      </div>
      <div className="tm-hero-actions">
        <a href="/admin/technician-availability">근무·휴무 설정</a>
        <a href="/admin/dispatch">자동배정</a>
        <a href="/admin/schedule">AS 캘린더</a>
      </div>
    </header>

    {message&&<aside className="tm-message">{message}</aside>}

    <section className="tm-controlbar">
      <label>
        <span>운영 기준일</span>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </label>
      <label className="tm-search">
        <span>기사 검색</span>
        <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="이름·팀·담당지역·연락처"/>
      </label>
      <label>
        <span>상태 필터</span>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          {['전체','활성','비활성','근무가능','휴무·연차·교육','한도초과'].map(value=><option key={value}>{value}</option>)}
        </select>
      </label>
      <button type="button" onClick={()=>void load()} disabled={loading}>
        {loading?'조회 중':'새로고침'}
      </button>
    </section>

    <section className="tm-summary">
      <article><small>활성 기사</small><strong>{summary?.active_technicians||0}</strong><span>전체 {summary?.total||0}명</span></article>
      <article><small>오늘 근무 가능</small><strong>{summary?.available_technicians||0}</strong><span>제외 {summary?.unavailable_technicians||0}명</span></article>
      <article><small>오늘 배정</small><strong>{summary?.assigned_count||0}건</strong><span>총 한도 {summary?.total_capacity||0}건</span></article>
      <article><small>남은 처리 여력</small><strong>{summary?.remaining_capacity||0}건</strong><span>자동배정 가능 여력</span></article>
      <article><small>검토대기</small><strong>{summary?.review_pending_count||0}건</strong><span>관리자 확인 필요</span></article>
      <article className="alert"><small>반려</small><strong>{summary?.rejected_count||0}건</strong><span>기사 보완 필요</span></article>
    </section>

    <section className="tm-layout">
      <article className="tm-form">
        <div className="section-title">
          <p>NEW TECHNICIAN</p>
          <h2>기사 등록</h2>
          <span>자동배정에 사용할 기본 정보를 입력합니다.</span>
        </div>

        <label><span>기사명</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
        <label><span>연락처</span><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label><span>담당지역</span><input value={form.region} onChange={e=>setForm({...form,region:e.target.value})} placeholder="예: 고양·파주·김포"/></label>
        <label><span>소속팀</span><input value={form.team_name} onChange={e=>setForm({...form,team_name:e.target.value})} placeholder="예: 경기북부팀"/></label>
        <label><span>일일 처리한도</span><input type="number" min="1" max="20" value={form.daily_capacity} onChange={e=>setForm({...form,daily_capacity:Number(e.target.value)})}/></label>
        <label><span>메모</span><textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} placeholder="특이사항, 지원 가능 지역 등"/></label>

        <button onClick={create}>기사 등록</button>
      </article>

      <article className="tm-list">
        <div className="tm-list-head">
          <div className="section-title">
            <p>TECHNICIAN OPERATIONS</p>
            <h2>기사별 당일 운영현황</h2>
            <span>{date} 기준 · {filtered.length}명 표시</span>
          </div>
        </div>

        <div className="tm-cards">
          {filtered.length===0?(
            <div className="tm-empty">조건에 맞는 기사가 없습니다.</div>
          ):filtered.map(item=>{
            const availability=availabilityLabel(item);
            const overloaded=Number(item.today_count||0)>=Number(item.daily_capacity||5);
            const percent=Math.min(100,Number(item.utilization_percent||0));

            return <article className={!item.is_active?'tm-card off':'tm-card'} key={item.id}>
              <div className="tm-card-head">
                <div>
                  <div className="tm-card-name">
                    <h3>{item.name}</h3>
                    <span className={'availability '+availability.replaceAll('·','-')}>{availability}</span>
                  </div>
                  <p>{item.team_name||'소속팀 미입력'} · {item.region||'담당지역 미입력'}</p>
                </div>
                <div className="tm-card-actions">
                  <button onClick={()=>setEditing(item)}>수정</button>
                  <button className={item.is_active?'stop':'start'} onClick={()=>void toggle(item)}>
                    {item.is_active?'비활성':'활성화'}
                  </button>
                </div>
              </div>

              <div className="tm-work-state">
                <div>
                  <span>오늘 배정</span>
                  <strong>{item.today_count||0}/{item.daily_capacity||5}건</strong>
                </div>
                <div className="capacity-track"><i style={{width:`${percent}%`}} className={overloaded?'over':''}/></div>
                <small>{overloaded?'처리한도 도달':'남은 여력 '+(item.remaining_capacity||0)+'건'}</small>
              </div>

              <div className="tm-kpi-grid">
                <div><span>예정</span><strong>{item.scheduled_count||0}</strong></div>
                <div><span>진행중</span><strong>{item.active_count||0}</strong></div>
                <div><span>검토대기</span><strong>{item.review_pending_count||0}</strong></div>
                <div><span>승인완료</span><strong>{item.approved_count||0}</strong></div>
                <div className={item.rejected_count?'danger':''}><span>반려</span><strong>{item.rejected_count||0}</strong></div>
              </div>

              <div className="tm-card-footer">
                <span>{item.phone||'연락처 미입력'}</span>
                <span>
                  {availability==='근무'&&item.availability_start_time&&item.availability_end_time
                    ?`${item.availability_start_time.slice(0,5)}~${item.availability_end_time.slice(0,5)}`
                    :item.availability_note||'별도 근무설정 없음'}
                </span>
                <a href={'/admin/technician-availability?date='+date}>근무설정</a>
              </div>
            </article>;
          })}
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
  </div>;
}
