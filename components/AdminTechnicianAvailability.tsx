'use client';

import {useEffect,useMemo,useState} from 'react';

type Technician={id:string;name:string;region?:string|null;team_name?:string|null;is_active:boolean};
type Availability={
  id:string;
  technician_id:string;
  work_date:string;
  availability_type:string;
  start_time?:string|null;
  end_time?:string|null;
  note?:string|null;
  technicians?:Technician|null;
};

function todayKst(){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date());
}

export default function AdminTechnicianAvailability(){
  const [technicians,setTechnicians]=useState<Technician[]>([]);
  const [rows,setRows]=useState<Availability[]>([]);
  const [date,setDate]=useState(todayKst());
  const [form,setForm]=useState({
    technician_id:'',availability_type:'근무',start_time:'09:00',end_time:'18:00',note:''
  });
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);

  async function load(){
    const [techResponse,availabilityResponse]=await Promise.all([
      fetch('/api/admin/technicians',{cache:'no-store'}),
      fetch('/api/admin/technician-availability?date='+encodeURIComponent(date),{cache:'no-store'}),
    ]);
    const techJson=await techResponse.json();
    const availabilityJson=await availabilityResponse.json();
    if(!techResponse.ok){setMessage(techJson.error||'기사 조회 오류');return;}
    if(!availabilityResponse.ok){setMessage(availabilityJson.error||'근무 설정 조회 오류');return;}
    const active=(techJson.data||[]).filter((row:Technician)=>row.is_active);
    setTechnicians(active);
    setRows(availabilityJson.data||[]);
    setForm(current=>({...current,technician_id:current.technician_id||active[0]?.id||''}));
  }

  useEffect(()=>{void load()},[date]);

  const configuredIds=useMemo(()=>new Set(rows.map(row=>row.technician_id)),[rows]);

  async function save(){
    if(!form.technician_id){setMessage('기사를 선택해 주세요.');return;}
    try{
      setSaving(true);
      const response=await fetch('/api/admin/technician-availability',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,work_date:date}),
      });
      const json=await response.json();
      if(!response.ok){setMessage(json.error||'저장 오류');return;}
      setMessage('기사 근무 설정이 저장되었습니다.');
      await load();
    }finally{setSaving(false);}
  }

  async function remove(id:string){
    const response=await fetch('/api/admin/technician-availability/'+id,{method:'DELETE'});
    const json=await response.json();
    if(!response.ok){setMessage(json.error||'삭제 오류');return;}
    setMessage('기본 근무 상태로 되돌렸습니다.');
    await load();
  }

  return <div className="ta">
    <header>
      <div><p>RECHAIR ADMIN</p><h1>기사 근무·휴무 관리</h1><span>자동배정에서 휴무, 연차, 교육 및 근무시간을 반영합니다.</span></div>
      <nav><a href="/admin/dispatch">자동배정</a><a href="/admin/technicians">기사관리</a><a href="/admin/schedule">AS 캘린더</a></nav>
    </header>

    {message&&<aside>{message}</aside>}

    <section className="ta-summary">
      <article><small>적용 날짜</small><strong>{date}</strong></article>
      <article><small>활성 기사</small><strong>{technicians.length}명</strong></article>
      <article><small>별도 설정</small><strong>{rows.length}명</strong></article>
      <article className="dark"><small>기본 근무</small><strong>{Math.max(0,technicians.length-configuredIds.size)}명</strong></article>
    </section>

    <section className="ta-layout">
      <article className="ta-form">
        <h2>날짜별 설정</h2>
        <label><span>적용 날짜</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        <label><span>기사</span><select value={form.technician_id} onChange={e=>setForm({...form,technician_id:e.target.value})}>{technicians.map(row=><option key={row.id} value={row.id}>{row.name} · {row.region||row.team_name||'지역 미입력'}</option>)}</select></label>
        <label><span>구분</span><select value={form.availability_type} onChange={e=>setForm({...form,availability_type:e.target.value})}>{['근무','휴무','연차','교육'].map(value=><option key={value}>{value}</option>)}</select></label>
        {form.availability_type==='근무'&&<div className="time-grid">
          <label><span>시작</span><input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></label>
          <label><span>종료</span><input type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></label>
        </div>}
        <label><span>메모</span><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="예: 오전 교육, 오후 정상근무"/></label>
        <button onClick={save} disabled={saving}>{saving?'저장 중…':'근무 설정 저장'}</button>
      </article>

      <article className="ta-list">
        <div className="ta-list-head"><div><p>DAILY AVAILABILITY</p><h2>{date} 설정 현황</h2></div></div>
        <div className="ta-table">
          {technicians.map(technician=>{
            const item=rows.find(row=>row.technician_id===technician.id);
            return <div key={technician.id} className={item&&item.availability_type!=='근무'?'off':''}>
              <section><b>{technician.name}</b><span>{technician.region||technician.team_name||'담당지역 미입력'}</span></section>
              <section><small>상태</small><strong>{item?.availability_type||'기본 근무'}</strong></section>
              <section><small>근무시간</small><strong>{item?.availability_type==='근무'?(item.start_time&&item.end_time?`${item.start_time.slice(0,5)}~${item.end_time.slice(0,5)}`:'시간 제한 없음'):'배정 제외'}</strong></section>
              <section><small>메모</small><strong>{item?.note||'-'}</strong></section>
              <section>{item?<button onClick={()=>remove(item.id)}>설정 해제</button>:<em>자동배정 가능</em>}</section>
            </div>;
          })}
        </div>
      </article>
    </section>
  </div>;
}
