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
  departed_at?:string|null;
  arrived_at?:string|null;
  work_started_at?:string|null;
  completed_at?:string|null;
  report_approval_status?:string|null;
};

const iso=(d=new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const fmtTime=(value:string) =>
  new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});

const areaKey=(row:RouteItem)=>{
  const text=`${row.region||''} ${row.address||''}`.replace(/\s+/g,' ').trim();
  const tokens=['강남','서초','송파','강동','마포','은평','고양','덕양','일산','파주','김포','부천','광명','안양','군포','의왕','수원','용인','화성','평택','광주','성남','하남','남양주','의정부','양주','포천'];
  return tokens.find(token=>text.includes(token))||text.split(' ').slice(0,2).join(' ')||'미입력';
};

const isClosed=(status:string)=>['완료','취소','승인'].includes(status);

const minutesDiff=(later:number,earlier:number)=>Math.floor((later-earlier)/60000);

function routeHealth(row:RouteItem,now:number){
  if(isClosed(row.status))return {key:'done',label:'완료',detail:'처리 완료'};
  if(row.work_started_at)return {key:'active',label:'작업중',detail:`작업 ${Math.max(0,minutesDiff(now,new Date(row.work_started_at).getTime()))}분`};
  if(row.arrived_at)return {key:'active',label:'방문중',detail:`도착 ${Math.max(0,minutesDiff(now,new Date(row.arrived_at).getTime()))}분`};
  if(row.departed_at)return {key:'moving',label:'이동중',detail:`출발 ${Math.max(0,minutesDiff(now,new Date(row.departed_at).getTime()))}분`};

  const scheduled=new Date(row.scheduled_at).getTime();
  const delta=minutesDiff(now,scheduled);
  if(delta>=15)return {key:'late',label:'지연',detail:`${delta}분 지연`};
  if(delta>=-30)return {key:'risk',label:'임박',detail:delta>=0?'방문시간 경과':`${Math.abs(delta)}분 후`};
  return {key:'scheduled',label:'예정',detail:`${Math.abs(delta)}분 후`};
}

export default function AdminRoutePlanner(){
  const [date,setDate]=useState(iso());
  const [technicians,setTechnicians]=useState<Technician[]>([]);
  const [technician,setTechnician]=useState('');
  const [rows,setRows]=useState<RouteItem[]>([]);
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [adjustTimes,setAdjustTimes]=useState(false);
  const [dayStart,setDayStart]=useState('09:00');
  const [travelBuffer,setTravelBuffer]=useState(30);
  const [viewFilter,setViewFilter]=useState<'all'|'issues'|'open'>('all');
  const [autoRefresh,setAutoRefresh]=useState(true);
  const [now,setNow]=useState(()=>Date.now());

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
  useEffect(()=>{
    const tick=window.setInterval(()=>setNow(Date.now()),30000);
    return ()=>window.clearInterval(tick);
  },[]);
  useEffect(()=>{
    if(!autoRefresh||!technician)return;
    const refresh=window.setInterval(()=>loadRoutes(),60000);
    return ()=>window.clearInterval(refresh);
  },[autoRefresh,technician,date]);

  const diagnostics=useMemo(()=>{
    const conflicts:string[]=[];
    const sorted=[...rows].sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime());
    for(let i=0;i<sorted.length-1;i++){
      const current=sorted[i];
      const next=sorted[i+1];
      const end=new Date(current.scheduled_at).getTime()+Number(current.duration_minutes||60)*60000;
      const nextStart=new Date(next.scheduled_at).getTime();
      if(end>nextStart){
        conflicts.push(`${current.customer_name} → ${next.customer_name}`);
      }
    }
    return {
      missingAddress:rows.filter(r=>!(r.address||r.region)).length,
      conflicts,
      open:rows.filter(r=>!isClosed(r.status)).length,
      areas:new Set(rows.map(areaKey)).size,
    };
  },[rows]);

  const totals=useMemo(()=>({
    count:rows.length,
    minutes:rows.reduce((s,r)=>s+Number(r.duration_minutes||0),0),
    completed:rows.filter(r=>isClosed(r.status)).length,
    remaining:rows.filter(r=>!isClosed(r.status)).length,
    late:rows.filter(r=>routeHealth(r,now).key==='late').length,
    risk:rows.filter(r=>routeHealth(r,now).key==='risk').length,
    active:rows.filter(r=>['active','moving'].includes(routeHealth(r,now).key)).length,
  }),[rows,now]);

  const visibleRows=useMemo(()=>rows.filter(row=>{
    const health=routeHealth(row,now);
    if(viewFilter==='issues')return ['late','risk'].includes(health.key);
    if(viewFilter==='open')return !isClosed(row.status);
    return true;
  }),[rows,viewFilter,now]);

  function move(index:number,direction:-1|1){
    const target=index+direction;
    if(target<0||target>=rows.length)return;

    const copy=[...rows];
    [copy[index],copy[target]]=[copy[target],copy[index]];
    setRows(copy.map((r,i)=>({...r,route_order:i+1})));
  }

  function recommendOrder(){
    const completed=rows.filter(r=>isClosed(r.status));
    const open=rows.filter(r=>!isClosed(r.status));

    open.sort((a,b)=>{
      const areaCompare=areaKey(a).localeCompare(areaKey(b),'ko');
      if(areaCompare!==0)return areaCompare;
      return new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime();
    });

    const next=[...completed,...open].map((r,i)=>({...r,route_order:i+1}));
    setRows(next);
    setMessage('주소 권역과 기존 방문시간을 기준으로 권장 순서를 계산했습니다. 저장 전 순서를 확인하세요.');
  }

  function buildSchedulePayload(){
    if(!adjustTimes)return rows.map((r,i)=>({id:r.id,route_order:i+1}));

    const [hour,minute]=dayStart.split(':').map(Number);
    const cursor=new Date(`${date}T00:00:00`);
    cursor.setHours(hour,minute,0,0);

    return rows.map((r,i)=>{
      const scheduled_at=cursor.toISOString();
      cursor.setMinutes(cursor.getMinutes()+Number(r.duration_minutes||60)+travelBuffer);
      return {id:r.id,route_order:i+1,scheduled_at};
    });
  }

  async function saveOrder(){
    setSaving(true);
    const r=await fetch('/api/admin/routes/reorder',{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({items:buildSchedulePayload()}),
    });
    const j=await r.json();
    setSaving(false);

    if(!r.ok){setMessage(j.error||'동선 저장 오류');return;}
    setMessage(adjustTimes?'방문 순서와 방문시간이 함께 저장되었습니다.':'방문 순서가 저장되었습니다.');
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
        <span>일정 충돌과 주소 누락을 확인하고 권장 방문 순서를 적용합니다.</span>
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
      <button className="recommend" onClick={recommendOrder} disabled={rows.length<2}>권장 순서 계산</button>
      <button className="copy" onClick={copyPlan}>동선 복사</button>
      <button className="save" onClick={saveOrder} disabled={saving}>
        {saving?'저장 중':'방문 순서 저장'}
      </button>
    </section>

    <section className="route-options">
      <label className="check-row">
        <input type="checkbox" checked={adjustTimes} onChange={e=>setAdjustTimes(e.target.checked)}/>
        <span>저장할 때 순서에 맞춰 방문시간도 재배치</span>
      </label>
      <label>
        <span>업무 시작</span>
        <input type="time" value={dayStart} onChange={e=>setDayStart(e.target.value)} disabled={!adjustTimes}/>
      </label>
      <label>
        <span>이동 여유</span>
        <select value={travelBuffer} onChange={e=>setTravelBuffer(Number(e.target.value))} disabled={!adjustTimes}>
          <option value={15}>15분</option>
          <option value={30}>30분</option>
          <option value={45}>45분</option>
          <option value={60}>60분</option>
        </select>
      </label>
    </section>

    <section className="route-summary route-summary-live">
      <article><small>방문 건수</small><strong>{totals.count}건</strong></article>
      <article><small>진행 중</small><strong>{totals.active}건</strong></article>
      <article className={totals.risk?'warning-card':''}><small>방문 임박</small><strong>{totals.risk}건</strong></article>
      <article className={totals.late?'danger-card':'dark'}><small>일정 지연</small><strong>{totals.late}건</strong></article>
      <article><small>주소 누락</small><strong>{diagnostics.missingAddress}건</strong></article>
      <article className={diagnostics.conflicts.length?'warning-card':''}><small>시간 충돌</small><strong>{diagnostics.conflicts.length}건</strong></article>
    </section>

    <section className="route-monitor">
      <div className="monitor-filters">
        <button className={viewFilter==='all'?'active':''} onClick={()=>setViewFilter('all')}>전체</button>
        <button className={viewFilter==='open'?'active':''} onClick={()=>setViewFilter('open')}>미완료</button>
        <button className={viewFilter==='issues'?'active':''} onClick={()=>setViewFilter('issues')}>지연·임박</button>
      </div>
      <label><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}/> 1분 자동 갱신</label>
      <span>기준 시각 {new Date(now).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span>
    </section>

    {(diagnostics.missingAddress>0||diagnostics.conflicts.length>0)&&<section className="route-alerts">
      {diagnostics.missingAddress>0&&<p>주소 또는 지역이 없는 일정이 {diagnostics.missingAddress}건 있습니다. 실제 거리 기반 동선 계산 전에 주소를 보완하세요.</p>}
      {diagnostics.conflicts.map(item=><p key={item}>시간 충돌: {item}</p>)}
    </section>}

    <section className="route-board">
      <div className="route-head">
        <div>
          <p>DAILY ROUTE</p>
          <h2>{technician||'기사 미선택'}</h2>
        </div>
        <span>{date} · {diagnostics.areas}개 권역</span>
      </div>

      {visibleRows.length===0?<p className="empty">{rows.length?'선택한 조건에 해당하는 일정이 없습니다.':'선택한 날짜에 배정된 일정이 없습니다.'}</p>:
        <div className="route-list">
          {visibleRows.map((item,index)=>{const health=routeHealth(item,now);const rowIndex=rows.findIndex(r=>r.id===item.id);return <article key={item.id} className={`${!(item.address||item.region)?'missing-address ':''}health-${health.key}`.trim()}>
            <div className="order">{index+1}</div>

            <div className="visit-info">
              <div className="visit-title">
                <time>{fmtTime(item.scheduled_at)}</time>
                <b>{item.customer_name}</b>
                <small>{item.status}</small>
                <small className="area-chip">{areaKey(item)}</small>
                <small className={`health-chip ${health.key}`}>{health.label}</small>
              </div>
              <span>{item.service_type||'서비스 미입력'} · 예상 {item.duration_minutes||60}분</span>
              <em>{item.address||item.region||'주소 미입력'}</em>
              <strong className={`health-detail ${health.key}`}>{health.detail}</strong>
              {item.memo&&<p>{item.memo}</p>}
            </div>

            <div className="route-actions">
              <button onClick={()=>move(rowIndex,-1)} disabled={rowIndex===0}>↑</button>
              <button onClick={()=>move(rowIndex,1)} disabled={rowIndex===rows.length-1}>↓</button>
              <a href={mapUrl(item.address||item.region)} target="_blank">지도</a>
              <a href={'tel:'+(item.phone||'')}>전화</a>
              <a href={`/admin/schedule?date=${date}`}>캘린더</a>
            </div>
          </article>})}
        </div>
      }
    </section>

    <section className="route-guide">
      <h3>운영 방법</h3>
      <p>‘권장 순서 계산’은 주소 권역과 기존 방문시간을 기준으로 가까운 지역끼리 묶습니다. 지연은 예정시간 15분 경과 후에도 출발·도착·작업 기록이 없는 일정이며, 임박은 방문 30분 전부터 표시됩니다.</p>
    </section>
  </div>
}
