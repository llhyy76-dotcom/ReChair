'use client';

import {useEffect,useMemo,useState} from 'react';

type Candidate={
  id:string;
  name:string;
  region?:string|null;
  team_name?:string|null;
  score:number;
  score_breakdown?:{
    region:number;
    workload:number;
    schedule_fit:number;
    availability:number;
    capacity:number;
    total:number;
  };
  reasons:string[];
  eligible:boolean;
  today_count:number;
  daily_capacity:number;
};

function defaultDateTime(){
  const date=new Date();
  date.setHours(date.getHours()+1,0,0,0);
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}

export default function AdminDispatchAI(){
  const [waiting,setWaiting]=useState<any[]>([]);
  const [selectedId,setSelectedId]=useState('');
  const [scheduledAt,setScheduledAt]=useState(defaultDateTime());
  const [duration,setDuration]=useState(60);
  const [result,setResult]=useState<any>(null);
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);

  const selected=useMemo(
    ()=>waiting.find(item=>item.id===selectedId)||null,
    [waiting,selectedId]
  );

  async function load(){
    const date=scheduledAt.slice(0,10);
    const response=await fetch(
      '/api/admin/dispatch/overview?date='+encodeURIComponent(date),
      {cache:'no-store'}
    );
    const json=await response.json();
    if(!response.ok){setMessage(json.error||'배정대기 조회 오류');return;}
    const items=json.data?.waiting_consultations||[];
    setWaiting(items);
    setSelectedId(current=>current||items[0]?.id||'');
  }

  useEffect(()=>{void load()},[scheduledAt]);

  async function simulate(){
    if(!selected)return;
    if(!selected.region||!selected.address){
      setMessage('상담 CRM에서 지역과 주소를 먼저 입력해 주세요.');
      return;
    }

    try{
      setLoading(true);
      setMessage('');
      setResult(null);
      const params=new URLSearchParams({
        region:selected.region,
        address:selected.address,
        scheduled_at:new Date(scheduledAt).toISOString(),
        duration_minutes:String(duration),
      });
      const response=await fetch(
        '/api/admin/dispatch/recommend?'+params.toString(),
        {cache:'no-store'}
      );
      const json=await response.json();
      if(!response.ok){setMessage(json.error||'AI 추천 계산 오류');return;}
      setResult(json.data);
    }finally{
      setLoading(false);
    }
  }

  return <main className="dispatch-ai-page">
    <section className="dispatch-ai-hero">
      <div>
        <p>RECHAIR OMS v0.6</p>
        <h1>AI 자동배정센터</h1>
        <span>지역·업무량·일정 여유·근무 가능 여부를 점수로 비교합니다.</span>
      </div>
      <a href="/admin/dispatch">기존 자동배정 열기</a>
    </section>

    {message&&<aside className="dispatch-ai-message">{message}</aside>}

    <section className="dispatch-ai-summary">
      <article><small>배정대기</small><strong>{waiting.length}건</strong></article>
      <article><small>추천 결과</small><strong>{result?.top3?.length||0}명</strong></article>
      <article><small>신뢰도</small><strong>{result?.confidence?.level||'-'}</strong></article>
      <article className="dark"><small>1순위 점수</small><strong>{result?.top3?.[0]?.score_breakdown?.total??'-'}점</strong></article>
    </section>

    <section className="dispatch-ai-workspace">
      <article className="dispatch-ai-input">
        <header><p>SIMULATION INPUT</p><h2>배정 시뮬레이션</h2></header>
        <label>
          <span>배정대기 상담</span>
          <select value={selectedId} onChange={event=>{setSelectedId(event.target.value);setResult(null)}}>
            {waiting.length===0&&<option value="">배정대기 상담 없음</option>}
            {waiting.map(item=><option key={item.id} value={item.id}>
              {item.customer_name} · {item.region||'지역 미입력'}
            </option>)}
          </select>
        </label>
        <div className="dispatch-ai-customer">
          <b>{selected?.customer_name||'상담을 선택하세요'}</b>
          <span>{selected?.phone||'-'}</span>
          <p>{selected?.address||'주소 미입력'}</p>
        </div>
        <label><span>방문일시</span><input type="datetime-local" value={scheduledAt} onChange={event=>{setScheduledAt(event.target.value);setResult(null)}}/></label>
        <label><span>예상 소요시간</span><select value={duration} onChange={event=>{setDuration(Number(event.target.value));setResult(null)}}>
          {[30,45,60,90,120,180].map(value=><option key={value} value={value}>{value}분</option>)}
        </select></label>
        <button onClick={simulate} disabled={loading||!selected}>{loading?'AI 계산 중…':'AI 추천 실행'}</button>
      </article>

      <article className="dispatch-ai-results">
        <header>
          <div><p>TOP 3 RECOMMENDATION</p><h2>추천 기사 비교</h2></div>
          {result?.confidence&&<span className={'confidence '+(result.confidence.level==='검토필요'?'warn':'')}>
            신뢰도 {result.confidence.level}
          </span>}
        </header>
        {!result&&<div className="dispatch-ai-empty">상담과 방문일시를 선택한 뒤 AI 추천을 실행하세요.</div>}
        {result&&<>
          <p className="confidence-reason">{result.confidence?.reason}</p>
          <div className="dispatch-ai-ranking">
            {(result.top3||[]).map((candidate:Candidate,index:number)=><CandidateCard key={candidate.id} candidate={candidate} rank={index+1}/>) }
            {(result.top3||[]).length===0&&<div className="dispatch-ai-empty">배정 가능한 기사가 없습니다.</div>}
          </div>
        </>}
      </article>
    </section>
  </main>;
}

function CandidateCard({candidate,rank}:{candidate:Candidate;rank:number}){
  const breakdown=candidate.score_breakdown;
  return <section className={'ai-candidate rank-'+rank}>
    <div className="ai-candidate-head">
      <span>{rank}위</span>
      <div><b>{candidate.name}</b><small>{candidate.region||candidate.team_name||'담당지역 미입력'}</small></div>
      <strong>{breakdown?.total??candidate.score}점</strong>
    </div>
    {breakdown&&<div className="score-grid">
      <Score label="지역" value={breakdown.region} max={35}/>
      <Score label="업무량" value={breakdown.workload} max={20}/>
      <Score label="일정여유" value={breakdown.schedule_fit} max={20}/>
      <Score label="근무상태" value={breakdown.availability} max={15}/>
      <Score label="처리여력" value={breakdown.capacity} max={10}/>
    </div>}
    <p>{candidate.reasons.join(' · ')}</p>
    <footer>당일 {candidate.today_count}/{candidate.daily_capacity}건</footer>
  </section>;
}

function Score({label,value,max}:{label:string;value:number;max:number}){
  return <div><span>{label}</span><b>{value}/{max}</b><i><em style={{width:`${Math.round(value/max*100)}%`}}/></i></div>;
}
