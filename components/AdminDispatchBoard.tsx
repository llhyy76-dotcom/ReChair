'use client';
import {useEffect,useMemo,useState} from 'react';

export default function AdminDispatchBoard(){
  const [techs,setTechs]=useState<any[]>([]);
  const [waiting,setWaiting]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [recommend,setRecommend]=useState<any>(null);
  const [scheduledAt,setScheduledAt]=useState('');
  const [message,setMessage]=useState('');

  async function load(){
    const r=await fetch('/api/admin/dispatch/overview',{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'배정 현황 조회 오류');return;}
    setTechs(j.data?.technicians||[]);
    setWaiting(j.data?.waiting_consultations||[]);
  }
  useEffect(()=>{load()},[]);

  const summary=useMemo(()=>({
    waiting:waiting.length,
    active:techs.filter(t=>t.is_active).length,
    capacity:techs.reduce((s,t)=>s+Number(t.daily_capacity||0),0),
    assigned:techs.reduce((s,t)=>s+Number(t.today_count||0),0),
  }),[waiting,techs]);

  async function getRecommend(item:any){
    setSelected(item); setRecommend(null);
    const p=new URLSearchParams({region:item.region||'',address:item.address||''});
    const r=await fetch('/api/admin/dispatch/recommend?'+p.toString(),{cache:'no-store'});
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'추천 기사 조회 오류');return;}
    setRecommend(j.data);
  }

  async function assign(){
    if(!selected||!recommend?.technician?.name)return;
    if(!scheduledAt){setMessage('방문 일시를 입력해 주세요.');return;}
    const r=await fetch('/api/admin/consultations/'+selected.id+'/schedule',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        scheduled_at:scheduledAt,
        assignee:recommend.technician.name,
        duration_minutes:60,
        address:selected.address||selected.region||'',
        memo:'지역·업무량 기반 자동 추천 배정'
      })
    });
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'일정 생성 오류');return;}
    setMessage(recommend.technician.name+'에 일정이 배정되었습니다.');
    setSelected(null); setRecommend(null); setScheduledAt(''); load();
  }

  return <div className="dispatch">
    <header><div><p>RECHAIR ADMIN</p><h1>지역 기반 자동배정</h1><span>담당지역과 당일 업무량을 기준으로 기사·팀을 추천합니다.</span></div>
    <nav><a href="/admin/dashboard">대시보드</a><a href="/admin/schedule">AS 캘린더</a><a href="/admin/technicians">기사 관리</a></nav></header>

    {message&&<aside>{message}</aside>}

    <section className="dispatch-summary">
      <article><small>배정대기 상담</small><strong>{summary.waiting}</strong></article>
      <article><small>활성 기사·팀</small><strong>{summary.active}</strong></article>
      <article><small>오늘 총 처리한도</small><strong>{summary.capacity}건</strong></article>
      <article className="dark"><small>오늘 배정</small><strong>{summary.assigned}건</strong></article>
    </section>

    <section className="dispatch-layout">
      <article className="waiting-panel">
        <div className="panel-head"><div><p>WAITING CONSULTATIONS</p><h2>배정대기 상담</h2></div><span>{waiting.length}건</span></div>
        <div className="waiting-list">
          {waiting.length===0?<p className="empty">배정대기 상담이 없습니다.</p>:waiting.map(item=>
            <button key={item.id} onClick={()=>getRecommend(item)}>
              <div><b>{item.customer_name}</b><span>{item.phone||'-'}</span><em>{item.region||'지역 미입력'} · {item.service_type||'서비스 미입력'}</em></div>
              <strong>추천받기 ›</strong>
            </button>
          )}
        </div>
      </article>

      <article className="capacity-panel">
        <div className="panel-head"><div><p>TEAM CAPACITY</p><h2>기사·팀 업무량</h2></div></div>
        <div className="capacity-list">{techs.map(t=>{
          const rate=t.daily_capacity?Math.min(100,Math.round((t.today_count/t.daily_capacity)*100)):0;
          return <div key={t.id} className={!t.is_active?'off':''}>
            <div><b>{t.name}</b><span>{(t.service_regions||[]).join(', ')||t.region||'담당지역 미입력'}</span></div>
            <div className="capacity-meta"><strong>{t.today_count}/{t.daily_capacity}건</strong><small>잔여 {t.remaining_capacity}건</small></div>
            <div className="bar"><i style={{width:rate+'%'}}/></div>
          </div>
        })}</div>
      </article>
    </section>

    {selected&&<div className="dispatch-backdrop" onClick={()=>setSelected(null)}>
      <div className="dispatch-modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><p>AUTO DISPATCH</p><h2>{selected.customer_name}</h2><span>{selected.region||'지역 미입력'} · {selected.address||'주소 미입력'}</span></div><button onClick={()=>setSelected(null)}>×</button></div>
        {!recommend?<div className="loading">추천 기사를 계산하는 중입니다.</div>:<>
          <section className="recommend-card"><small>추천 기사·팀</small><h3>{recommend.technician?.name||'추천 불가'}</h3><p>{recommend.reason}</p>
          <div><span>오늘 배정 {recommend.technician?.today_count||0}건</span><span>잔여 {recommend.technician?.remaining_capacity||0}건</span></div></section>
          <label className="schedule-time"><span>방문 일시</span><input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/></label>
          <footer><button className="cancel" onClick={()=>setSelected(null)}>취소</button><button onClick={assign} disabled={!recommend.technician}>추천 기사로 배정</button></footer>
        </>}
      </div>
    </div>}
  </div>
}
