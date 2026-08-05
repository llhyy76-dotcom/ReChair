'use client';

import {useEffect,useMemo,useState} from 'react';

type Location={latitude:number;longitude:number;accuracy_meters?:number|null;speed_mps?:number|null;updated_at:string;captured_at:string};
type Row={id:string;name:string;team_name?:string|null;region?:string|null;phone?:string|null;location?:Location|null};

function ageMinutes(value?:string){
  if(!value)return Infinity;
  return Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
}
function freshness(value?:string){
  const minutes=ageMinutes(value);
  if(minutes===Infinity)return {label:'위치 미공유',tone:'off'};
  if(minutes<3)return {label:'실시간',tone:'live'};
  if(minutes<15)return {label:`${minutes}분 전`,tone:'recent'};
  return {label:`${minutes}분 전`,tone:'stale'};
}
function mapLink(location?:Location|null){
  if(!location)return '#';
  return `https://map.kakao.com/link/map/${location.latitude},${location.longitude}`;
}

export default function AdminControlCenter(){
  const [rows,setRows]=useState<Row[]>([]);
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);
  const [autoRefresh,setAutoRefresh]=useState(true);

  async function load(){
    try{
      setLoading(true);
      const response=await fetch('/api/admin/technician-locations',{cache:'no-store'});
      const result=await response.json();
      if(!response.ok){setMessage(result.error||'위치 조회 오류');return;}
      setRows(result.data||[]);
      setMessage('');
    }catch{
      setMessage('기사 위치를 불러오지 못했습니다.');
    }finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);
  useEffect(()=>{
    if(!autoRefresh)return;
    const timer=window.setInterval(load,30_000);
    return()=>window.clearInterval(timer);
  },[autoRefresh]);

  const summary=useMemo(()=>({
    total:rows.length,
    live:rows.filter(row=>ageMinutes(row.location?.updated_at)<3).length,
    recent:rows.filter(row=>{const age=ageMinutes(row.location?.updated_at);return age>=3&&age<15}).length,
    offline:rows.filter(row=>ageMinutes(row.location?.updated_at)>=15).length,
  }),[rows]);

  return <div className="control-center">
    <header className="control-head">
      <div><p>RECHAIR ADMIN</p><h1>현장 관제센터</h1><span>기사가 위치 공유를 시작한 경우에만 최신 위치가 표시됩니다.</span></div>
      <nav><a href="/admin/schedule">AS 캘린더</a><a href="/admin/routes">방문동선</a><a href="/admin/technicians">기사관리</a></nav>
    </header>

    {message&&<aside className="control-message">{message}</aside>}

    <section className="control-summary">
      <article><small>활성 기사</small><strong>{summary.total}명</strong></article>
      <article><small>실시간 공유</small><strong>{summary.live}명</strong></article>
      <article><small>최근 15분</small><strong>{summary.recent}명</strong></article>
      <article className="dark"><small>미공유·오래됨</small><strong>{summary.offline}명</strong></article>
    </section>

    <section className="control-toolbar">
      <label><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}/> 30초 자동 새로고침</label>
      <button onClick={load} disabled={loading}>{loading?'불러오는 중':'지금 새로고침'}</button>
    </section>

    <section className="location-grid">
      {rows.map(row=>{
        const state=freshness(row.location?.updated_at);
        return <article key={row.id} className="location-card">
          <div className="location-title"><div><h2>{row.name}</h2><p>{row.team_name||row.region||'소속 미입력'}</p></div><span data-tone={state.tone}>{state.label}</span></div>
          {row.location?<>
            <dl><div><dt>위도</dt><dd>{row.location.latitude.toFixed(5)}</dd></div><div><dt>경도</dt><dd>{row.location.longitude.toFixed(5)}</dd></div><div><dt>정확도</dt><dd>{row.location.accuracy_meters?`약 ${Math.round(row.location.accuracy_meters)}m`:'-'}</dd></div><div><dt>갱신시각</dt><dd>{new Date(row.location.updated_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</dd></div></dl>
            <div className="location-actions"><a href={mapLink(row.location)} target="_blank" rel="noreferrer">지도에서 보기</a>{row.phone&&<a href={`tel:${row.phone}`}>전화</a>}</div>
          </>:<p className="no-location">기사가 모바일 화면에서 ‘위치 공유 시작’을 눌러야 표시됩니다.</p>}
        </article>
      })}
    </section>
  </div>;
}
