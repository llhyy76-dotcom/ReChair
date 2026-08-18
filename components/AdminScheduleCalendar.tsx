'use client';

import AdminFieldReport from '@/components/AdminFieldReport';
import {
  getDisplayStatus,
  getDisplayStatusClass,
  type DisplayStatus,
} from '@/lib/scheduleDisplayStatus';
import {useCallback,useEffect,useMemo,useState} from 'react';

const STATES=['배정대기','배정완료','이동중','방문중','작업중','완료','취소'];
const VIEWS=['day','week','month'] as const;
type ViewMode=(typeof VIEWS)[number];

const pad=(value:number)=>String(value).padStart(2,'0');
const isoDate=(date=new Date())=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const parseDate=(value:string)=>{
  const [year,month,day]=value.split('-').map(Number);
  return new Date(year,month-1,day);
};
const addDays=(date:Date,days:number)=>{
  const next=new Date(date);
  next.setDate(next.getDate()+days);
  return next;
};
const startOfWeek=(date:Date)=>{
  const next=new Date(date);
  const day=(next.getDay()+6)%7;
  next.setDate(next.getDate()-day);
  next.setHours(0,0,0,0);
  return next;
};
const startOfMonthGrid=(date:Date)=>startOfWeek(new Date(date.getFullYear(),date.getMonth(),1));
const toInputDateTime=(value:string)=>{
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const formatTime=(value:string)=>new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
const formatShortDate=(date:Date)=>`${date.getMonth()+1}/${date.getDate()}`;
const dateKey=(value:string|Date)=>isoDate(value instanceof Date?value:new Date(value));

function rangeFor(dateValue:string,view:ViewMode){
  const anchor=parseDate(dateValue);
  let start:Date;
  let end:Date;

  if(view==='week'){
    start=startOfWeek(anchor);
    end=addDays(start,7);
  }else if(view==='month'){
    start=startOfMonthGrid(anchor);
    end=addDays(start,42);
  }else{
    start=new Date(anchor);
    start.setHours(0,0,0,0);
    end=addDays(start,1);
  }

  return {start,end};
}

function statusLabel(item:any):DisplayStatus{
  return getDisplayStatus(item);
}

function isRentalInstallation(item:any){
  return item?.schedule_kind==='rental_installation';
}

function isRentalRetrieval(item:any){
  return item?.schedule_kind==='rental_retrieval';
}

function rentalJobLabel(item:any){
  if(isRentalInstallation(item))return '렌탈 설치';
  if(isRentalRetrieval(item))return '렌탈 회수';
  return '';
}

export default function AdminScheduleCalendar(){
  const [date,setDate]=useState(isoDate());
  const [view,setView]=useState<ViewMode>('day');
  const [items,setItems]=useState<any[]>([]);
  const [techs,setTechs]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);
  const [reportScheduleId,setReportScheduleId]=useState<string|null>(null);

  const load=useCallback(async()=>{
    try{
      setLoading(true);
      setMessage('');
      const {start,end}=rangeFor(date,view);
      const query=new URLSearchParams({
        start:start.toISOString(),
        end:end.toISOString(),
      });

      const [scheduleResponse,technicianResponse]=await Promise.all([
        fetch(`/api/admin/schedule?${query.toString()}`,{cache:'no-store'}),
        fetch('/api/admin/technicians',{cache:'no-store'}),
      ]);
      const scheduleResult=await scheduleResponse.json();
      const technicianResult=await technicianResponse.json();

      if(!scheduleResponse.ok||!technicianResponse.ok){
        setMessage(scheduleResult.error||technicianResult.error||'조회 오류');
        return;
      }

      setItems(scheduleResult.data||[]);
      setTechs(technicianResult.data||[]);
    }catch(error){
      console.error('admin schedule load error',error);
      setMessage('현장 운영 캘린더를 불러오지 못했습니다.');
    }finally{
      setLoading(false);
    }
  },[date,view]);

  useEffect(()=>{
    const queryDate=new URLSearchParams(window.location.search).get('date');
    if(queryDate&&/^\d{4}-\d{2}-\d{2}$/.test(queryDate))setDate(queryDate);
  },[]);

  useEffect(()=>{void load()},[load]);

  const activeTechs=useMemo(()=>techs.filter(t=>t.is_active),[techs]);
  const selectedDate=parseDate(date);
  const summary=useMemo(()=>{
    const counts:Record<string,number>={};
    items.forEach(item=>{
      const label=statusLabel(item);
      counts[label]=(counts[label]||0)+1;
    });
    return counts;
  },[items]);

  const recommend=useMemo(()=>{
    const candidates=activeTechs.map(t=>({
      name:t.name,
      count:items.filter(i=>i.assignee===t.name&&statusLabel(i)!=='취소').length,
    })).sort((a,b)=>a.count-b.count||a.name.localeCompare(b.name,'ko'));
    return candidates[0]?.name||'-';
  },[items,activeTechs]);

  const groups=useMemo(()=>['미배정',...activeTechs.map(t=>t.name)].map(name=>({
    name,
    items:items.filter(item=>(item.assignee||'미배정')===name),
  })),[items,activeTechs]);

  const weekDays=useMemo(()=>{
    const start=startOfWeek(selectedDate);
    return Array.from({length:7},(_,index)=>addDays(start,index));
  },[date]);

  const monthDays=useMemo(()=>{
    const start=startOfMonthGrid(selectedDate);
    return Array.from({length:42},(_,index)=>addDays(start,index));
  },[date]);

  const itemsByDate=useMemo(()=>{
    const map=new Map<string,any[]>();
    items.forEach(item=>{
      const key=dateKey(item.scheduled_at);
      map.set(key,[...(map.get(key)||[]),item]);
    });
    return map;
  },[items]);

  function moveDate(direction:number){
    const current=parseDate(date);
    if(view==='month')current.setMonth(current.getMonth()+direction);
    else current.setDate(current.getDate()+direction*(view==='week'?7:1));
    setDate(isoDate(current));
  }

  async function save(){
    if(!selected)return;
    const response=await fetch(`/api/admin/schedule/${selected.id}`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(selected),
    });
    const result=await response.json();
    if(!response.ok){
      setMessage(result.error||'저장 오류');
      return;
    }
    setMessage('일정이 저장되었습니다.');
    setSelected(null);
    void load();
  }

  function openDay(day:Date){
    setDate(isoDate(day));
    setView('day');
  }

  return <div className="ops">
    <header className="ops-title-row">
      <div>
        <p>RECHAIR ADMIN</p>
        <h1>현장 운영 캘린더</h1>
        <span>AS와 렌탈 설치·회수 일정을 월·주·일 단위로 관리합니다.</span>
      </div>
      <nav>
        <a href="/admin/dispatch">자동배정</a>
        <a href="/admin/technicians">기사관리</a>
        <a href="/admin/technician-availability">근무·휴무</a>
      </nav>
    </header>

    <section className="ops-toolbar">
      <div className="date-nav">
        <button type="button" onClick={()=>moveDate(-1)} aria-label="이전 기간">‹</button>
        <button type="button" onClick={()=>setDate(isoDate())}>오늘</button>
        <button type="button" onClick={()=>moveDate(1)} aria-label="다음 기간">›</button>
        <input type="date" value={date} onChange={event=>setDate(event.target.value)}/>
      </div>
      <div className="view-switch">
        <button className={view==='day'?'on':''} onClick={()=>setView('day')}>일간</button>
        <button className={view==='week'?'on':''} onClick={()=>setView('week')}>주간</button>
        <button className={view==='month'?'on':''} onClick={()=>setView('month')}>월간</button>
        <button type="button" onClick={()=>void load()} disabled={loading}>{loading?'불러오는 중':'새로고침'}</button>
      </div>
    </section>

    {message&&<aside className="ops-message">{message}</aside>}

    <section className="ops-summary">
      <article><small>전체 일정</small><strong>{items.length}</strong></article>
      <article><small>방문 예정</small><strong>{(summary['배정대기']||0)+(summary['방문예정']||0)}</strong></article>
      <article><small>현장 진행</small><strong>{(summary['이동중']||0)+(summary['현장도착']||0)+(summary['작업중']||0)}</strong></article>
      <article><small>검토 대기</small><strong>{summary['검토대기']||0}</strong></article>
      <article><small>승인 완료</small><strong>{summary['승인완료']||0}</strong></article>
      <article className="recommend"><small>현재 최소 업무 기사</small><strong>{recommend}</strong></article>
    </section>

    {view==='day'&&<section className="ops-board">
      {groups.map(group=><article key={group.name}>
        <div className="tech-head"><h2>{group.name}</h2><span>{group.items.length}건</span></div>
        <div className="tech-list">
          {group.items.length?group.items.map(item=><ScheduleButton key={item.id} item={item} onClick={()=>setSelected({...item})}/>):<p>일정 없음</p>}
        </div>
      </article>)}
    </section>}

    {view==='week'&&<section className="week-calendar">
      {weekDays.map(day=>{
        const dayItems=itemsByDate.get(isoDate(day))||[];
        const today=isoDate(day)===isoDate();
        return <article key={isoDate(day)} className={today?'today':''}>
          <button className="calendar-day-head" onClick={()=>openDay(day)}>
            <small>{day.toLocaleDateString('ko-KR',{weekday:'short'})}</small>
            <strong>{formatShortDate(day)}</strong>
            <span>{dayItems.length}건</span>
          </button>
          <div className="week-day-items">
            {dayItems.map(item=><ScheduleMini key={item.id} item={item} onClick={()=>setSelected({...item})}/>)}
            {!dayItems.length&&<p>일정 없음</p>}
          </div>
        </article>;
      })}
    </section>}

    {view==='month'&&<section className="month-calendar">
      <div className="month-weekdays">{['월','화','수','목','금','토','일'].map(label=><b key={label}>{label}</b>)}</div>
      <div className="month-grid">
        {monthDays.map(day=>{
          const key=isoDate(day);
          const dayItems=itemsByDate.get(key)||[];
          const muted=day.getMonth()!==selectedDate.getMonth();
          const today=key===isoDate();
          return <article key={key} className={`${muted?'muted ':''}${today?'today':''}`}>
            <button className="month-date" onClick={()=>openDay(day)}>{day.getDate()}</button>
            <div className="month-events">
              {dayItems.slice(0,4).map(item=><button key={item.id} className={`month-event ${getDisplayStatusClass(item)} ${isRentalInstallation(item)?'rental-installation-event':isRentalRetrieval(item)?'rental-retrieval-event':''}`} onClick={()=>setSelected({...item})}>
                <time>{formatTime(item.scheduled_at)}</time><span>{item.customer_name}</span>{rentalJobLabel(item)&&<em>{isRentalRetrieval(item)?'회수':'설치'}</em>}
              </button>)}
              {dayItems.length>4&&<button className="month-more" onClick={()=>openDay(day)}>+{dayItems.length-4}건 더보기</button>}
            </div>
          </article>;
        })}
      </div>
    </section>}

    {selected&&<div className="ops-backdrop" onClick={()=>setSelected(null)}>
      <div className="ops-modal" onClick={event=>event.stopPropagation()}>
        <div className="ops-modal-head">
          <div><p>{selected.service_type||'서비스'} {rentalJobLabel(selected)&&<b className={`schedule-kind-badge ${isRentalRetrieval(selected)?'retrieval':''}`}>{rentalJobLabel(selected)}</b>}</p><h2>{selected.customer_name}</h2><span>{selected.phone||'-'}</span></div>
          <button type="button" onClick={()=>setSelected(null)}>×</button>
        </div>
        <div className="selected-status-line">
          <span className={`status-pill ${getDisplayStatusClass(selected)}`}>{statusLabel(selected)}</span>
          <small>{selected.assignee||'미배정'} · {selected.region||'지역 미입력'}</small>
        </div>
        <div className="ops-fields">
          <label>방문일시<input type="datetime-local" value={toInputDateTime(selected.scheduled_at)} onChange={event=>setSelected({...selected,scheduled_at:new Date(event.target.value).toISOString()})}/></label>
          <label>담당기사<select value={selected.assignee||''} onChange={event=>setSelected({...selected,assignee:event.target.value||null})}><option value="">미배정</option>{activeTechs.map(tech=><option key={tech.id}>{tech.name}</option>)}</select></label>
          <label>소요시간<input type="number" min="10" step="10" value={selected.duration_minutes||60} onChange={event=>setSelected({...selected,duration_minutes:Number(event.target.value)})}/></label>
          <label>진행상태<select value={selected.status} onChange={event=>setSelected({...selected,status:event.target.value})}>{STATES.map(value=><option key={value}>{value}</option>)}</select></label>
        </div>
        <label className="ops-full">주소<input value={selected.address||''} onChange={event=>setSelected({...selected,address:event.target.value})}/></label>
        <label className="ops-full">메모<textarea value={selected.memo||''} onChange={event=>setSelected({...selected,memo:event.target.value})}/></label>
        <footer>
          <a href={`tel:${selected.phone||''}`}>고객 전화</a>
          {selected.address&&<a href={`https://map.kakao.com/link/search/${encodeURIComponent(selected.address)}`} target="_blank" rel="noreferrer">지도 열기</a>}
          {(selected.status==='완료'||selected.report_approval_status)&&<button type="button" onClick={()=>{setReportScheduleId(selected.id);setSelected(null)}}>작업보고 보기</button>}
          <button type="button" onClick={save}>저장</button>
        </footer>
      </div>
    </div>}

    {reportScheduleId&&<AdminFieldReport scheduleId={reportScheduleId} onClose={()=>{setReportScheduleId(null);void load()}}/>}
  </div>;
}

function ScheduleButton({item,onClick}:{item:any;onClick:()=>void}){
  return <button type="button" onClick={onClick}>
    <time>{formatTime(item.scheduled_at)}</time>
    <div><b>{item.customer_name} {rentalJobLabel(item)&&<i className={`schedule-kind-badge ${isRentalRetrieval(item)?'retrieval':''}`}>{rentalJobLabel(item)}</i>}</b><span>{item.region||'지역 미입력'} · {item.service_type||'서비스 미입력'}</span><em>{item.address||'주소 미입력'}</em></div>
    <div className="schedule-status-group"><small className={`status-pill ${getDisplayStatusClass(item)}`}>{statusLabel(item)}</small></div>
  </button>;
}

function ScheduleMini({item,onClick}:{item:any;onClick:()=>void}){
  return <button type="button" className={`schedule-mini ${getDisplayStatusClass(item)}`} onClick={onClick}>
    <div><time>{formatTime(item.scheduled_at)}</time><b>{item.customer_name}</b></div>
    <span>{item.assignee||'미배정'}{rentalJobLabel(item)?` · ${rentalJobLabel(item)}`:''}</span>
    <small>{statusLabel(item)}</small>
  </button>;
}
