'use client';
import AdminFieldReport from '@/components/AdminFieldReport';
import {useEffect,useMemo,useState} from 'react';
const STATES=['배정대기','배정완료','이동중','방문중','완료','취소'];
const iso=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export default function AdminScheduleCalendar(){
 const [date,setDate]=useState(iso()),[view,setView]=useState('day'),[items,setItems]=useState<any[]>([]),[techs,setTechs]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[message,setMessage]=useState('');
 const [
  reportScheduleId,
  setReportScheduleId,
]=useState<string|null>(null);
 async function load(){const [a,b]=await Promise.all([fetch(`/api/admin/schedule?date=${date}&view=${view}`,{cache:'no-store'}),fetch('/api/admin/technicians',{cache:'no-store'})]);const x=await a.json(),y=await b.json();if(!a.ok||!b.ok){setMessage(x.error||y.error||'조회 오류');return}setItems(x.data||[]);setTechs(y.data||[])}
 useEffect(()=>{load()},[date,view]);
 const groups=useMemo(()=>['미배정',...techs.filter(t=>t.is_active).map(t=>t.name)].map(name=>({name,items:items.filter(i=>(i.assignee||'미배정')===name)})),[items,techs]);
 const recommend=useMemo(()=>{const a=techs.filter(t=>t.is_active).map(t=>({name:t.name,count:items.filter(i=>i.assignee===t.name&&i.status!=='취소').length})).sort((x,y)=>x.count-y.count);return a[0]?.name||'-'},[items,techs]);
 async function save(){if(!selected)return;const r=await fetch('/api/admin/schedule/'+selected.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(selected)});const j=await r.json();if(!r.ok){setMessage(j.error||'저장 오류');return}setMessage('일정이 저장되었습니다.');setSelected(null);load()}
 return <div className="ops"><header><div><p>RECHAIR ADMIN</p><h1>AS 운영 캘린더</h1><span>기사별 일정과 업무량을 관리합니다.</span></div><nav><a href="/admin/dashboard">대시보드</a><a href="/admin/consultations">상담 CRM</a></nav></header>
 <section className="ops-controls"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/><button className={view==='day'?'on':''} onClick={()=>setView('day')}>일간</button><button className={view==='week'?'on':''} onClick={()=>setView('week')}>주간</button><button onClick={load}>새로고침</button></section>
 {message&&<aside>{message}</aside>}
  <section className="ops-summary"><article><small>전체 일정</small><strong>{items.length}</strong></article><article><small>배정대기</small><strong>{items.filter(i=>i.status==='배정대기').length}</strong></article><article><small>진행중</small><strong>{items.filter(i=>['이동중','방문중'].includes(i.status)).length}</strong></article><article><small>완료</small><strong>{items.filter(i=>i.status==='완료').length}</strong></article><article className="recommend"><small>자동추천 기사</small><strong>{recommend}</strong></article></section>
 <section className="ops-board">{groups.map(g=><article key={g.name}><div className="tech-head"><h2>{g.name}</h2><span>{g.items.length}건</span></div><div className="tech-list">{g.items.length?g.items.map(i=><button key={i.id} onClick={()=>setSelected(i)}><time>{new Date(i.scheduled_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</time><div><b>{i.customer_name}</b><span>{i.region||'지역 미입력'} · {i.service_type||'서비스 미입력'}</span><em>{i.address||'주소 미입력'}</em></div><div className="schedule-status-group">
  <small>{i.status}</small>

  {i.status==='완료'&&(
    <small
      className={
        'report-review-badge '+
        (i.report_approval_status||'검토대기')
      }
    >
      보고서 {i.report_approval_status||'검토대기'}
    </small>
  )}
</div></button>):<p>일정 없음</p>}</div></article>)}</section>
 {selected&&<div className="ops-backdrop" onClick={()=>setSelected(null)}><div className="ops-modal" onClick={e=>e.stopPropagation()}><div className="ops-modal-head"><div><p>{selected.service_type||'서비스'}</p><h2>{selected.customer_name}</h2><span>{selected.phone||'-'}</span></div><button onClick={()=>setSelected(null)}>×</button></div><div className="ops-fields"><label>방문일시<input type="datetime-local" value={selected.scheduled_at.slice(0,16)} onChange={e=>setSelected({...selected,scheduled_at:e.target.value})}/></label><label>담당기사<select value={selected.assignee||''} onChange={e=>setSelected({...selected,assignee:e.target.value||null})}><option value="">미배정</option>{techs.filter(t=>t.is_active).map(t=><option key={t.id}>{t.name}</option>)}</select></label><label>소요시간<input type="number" value={selected.duration_minutes||60} onChange={e=>setSelected({...selected,duration_minutes:Number(e.target.value)})}/></label><label>진행상태<select value={selected.status} onChange={e=>setSelected({...selected,status:e.target.value})}>{STATES.map(v=><option key={v}>{v}</option>)}</select></label></div><label className="ops-full">주소<input value={selected.address||''} onChange={e=>setSelected({...selected,address:e.target.value})}/></label><label className="ops-full">메모<textarea value={selected.memo||''} onChange={e=>setSelected({...selected,memo:e.target.value})}/></label><footer>
  <a href={'tel:'+(selected.phone||'')}>
    고객 전화
  </a>

  {selected.status==='완료'&&(
    <button
      type="button"
      onClick={()=>{
        setReportScheduleId(selected.id);
        setSelected(null);
      }}
    >
      작업보고 보기
    </button>
  )}

  <button
    type="button"
    onClick={save}
  >
    저장
  </button>
</footer></div></div>}
 {reportScheduleId&&(
  <AdminFieldReport
    scheduleId={reportScheduleId}
    onClose={()=>
      setReportScheduleId(null)
    }
  />
)}
 </div>}
