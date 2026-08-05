'use client';

import {useEffect,useMemo,useState} from 'react';

type Candidate={
  id:string;
  name:string;
  region?:string|null;
  team_name?:string|null;
  today_count:number;
  daily_capacity:number;
  remaining_capacity:number;
  region_match:boolean;
  has_conflict:boolean;
  is_over_capacity:boolean;
  eligible:boolean;
  score:number;
  reasons:string[];
  availability_type?:string|null;
  is_available?:boolean;
};

function defaultScheduledAt(){
  const now=new Date();
  now.setMinutes(now.getMinutes()+60);
  now.setMinutes(Math.ceil(now.getMinutes()/30)*30,0,0);
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}

export default function AdminDispatchBoard(){
  const [techs,setTechs]=useState<any[]>([]);
  const [waiting,setWaiting]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [recommend,setRecommend]=useState<any>(null);
  const [selectedCandidate,setSelectedCandidate]=useState<Candidate|null>(null);
  const [scheduledAt,setScheduledAt]=useState(defaultScheduledAt());
  const [durationMinutes,setDurationMinutes]=useState(60);
  const [regionInput,setRegionInput]=useState('');
  const [addressInput,setAddressInput]=useState('');
  const [message,setMessage]=useState('');
  const [loadingRecommend,setLoadingRecommend]=useState(false);
  const [assigning,setAssigning]=useState(false);

  async function load(){
    const date=scheduledAt.slice(0,10);
    const r=await fetch(
      '/api/admin/dispatch/overview?date='+encodeURIComponent(date),
      {cache:'no-store'}
    );
    const j=await r.json();
    if(!r.ok){setMessage(j.error||'배정 현황 조회 오류');return;}
    setTechs(j.data?.technicians||[]);
    setWaiting(j.data?.waiting_consultations||[]);
  }

  useEffect(()=>{void load()},[scheduledAt]);

  const summary=useMemo(()=>({
    waiting:waiting.length,
    active:techs.filter(t=>t.is_active).length,
    capacity:techs.reduce((s,t)=>s+Number(t.daily_capacity||0),0),
    assigned:techs.reduce((s,t)=>s+Number(t.today_count||0),0),
  }),[waiting,techs]);

  function openRecommend(item:any){
    setSelected(item);
    setRecommend(null);
    setSelectedCandidate(null);
    setMessage('');
    setScheduledAt(defaultScheduledAt());
    setDurationMinutes(60);
    setRegionInput(String(item.region||''));
    setAddressInput(String(item.address||''));
  }

  async function calculateRecommend(){
    if(!selected)return;
    if(!scheduledAt){setMessage('방문 일시를 입력해 주세요.');return;}
    if(!regionInput.trim()){setMessage('정확한 자동배정을 위해 지역을 입력해 주세요.');return;}
    if(!addressInput.trim()){setMessage('정확한 자동배정을 위해 주소를 입력해 주세요.');return;}

    try{
      setLoadingRecommend(true);
      setMessage('');
      const params=new URLSearchParams({
        region:regionInput,
        address:addressInput,
        scheduled_at:new Date(scheduledAt).toISOString(),
        duration_minutes:String(durationMinutes),
      });
      const r=await fetch(
        '/api/admin/dispatch/recommend?'+params.toString(),
        {cache:'no-store'}
      );
      const j=await r.json();
      if(!r.ok){setMessage(j.error||'추천 기사 조회 오류');return;}
      setRecommend(j.data);
      setSelectedCandidate(j.data?.technician||null);
    }finally{
      setLoadingRecommend(false);
    }
  }

  async function assign(){
    if(!selected||!selectedCandidate?.name)return;
    if(!scheduledAt){setMessage('방문 일시를 입력해 주세요.');return;}
    if(!regionInput.trim()||!addressInput.trim()){
      setMessage('지역과 주소를 입력한 뒤 배정해 주세요.');
      return;
    }

    try{
      setAssigning(true);
      const r=await fetch('/api/admin/consultations/'+selected.id+'/schedule',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          scheduled_at:new Date(scheduledAt).toISOString(),
          assignee:selectedCandidate.name,
          duration_minutes:durationMinutes,
          region:regionInput,
          address:addressInput||regionInput,
          memo:[
            '자동배정 추천 적용',
            ...(selectedCandidate.reasons||[]),
          ].join(' · '),
        }),
      });
      const j=await r.json();
      if(!r.ok){setMessage(j.error||'일정 생성 오류');return;}
      setMessage(selectedCandidate.name+' 기사에게 일정이 배정되었습니다.');
      setSelected(null);
      setRecommend(null);
      setSelectedCandidate(null);
      await load();
    }finally{
      setAssigning(false);
    }
  }

  return <div className="dispatch">
    <header>
      <div>
        <p>RECHAIR ADMIN</p>
        <div className="dispatch-title-row"><h1>스마트 자동배정</h1><b className="dispatch-version">정확도 개선 v3</b></div>
        <span>담당지역·업무량·일정 충돌을 함께 계산해 배정 후보를 추천합니다.</span>
      </div>
      <nav>
        <a href="/admin/dashboard">대시보드</a>
        <a href="/admin/schedule">AS 캘린더</a>
        <a href="/admin/technicians">기사 관리</a>
      </nav>
    </header>

    {message&&<aside>{message}</aside>}

    <section className="dispatch-summary">
      <article><small>배정대기 상담</small><strong>{summary.waiting}</strong></article>
      <article><small>활성 기사·팀</small><strong>{summary.active}</strong></article>
      <article><small>선택일 총 처리한도</small><strong>{summary.capacity}건</strong></article>
      <article className="dark"><small>선택일 배정</small><strong>{summary.assigned}건</strong></article>
    </section>

    <section className="dispatch-layout">
      <article className="waiting-panel">
        <div className="panel-head">
          <div><p>WAITING CONSULTATIONS</p><h2>배정대기 상담</h2></div>
          <span>{waiting.length}건</span>
        </div>
        <div className="waiting-list">
          {waiting.length===0
            ?<p className="empty">배정대기 상담이 없습니다.</p>
            :waiting.map(item=><button key={item.id} onClick={()=>openRecommend(item)}>
              <div>
                <b>{item.customer_name}</b>
                <span>{item.phone||'-'}</span>
                <em>{item.region||'지역 미입력'} · {item.service_type||'서비스 미입력'}</em>
              </div>
              <strong>배정 계산 ›</strong>
            </button>)}
        </div>
      </article>

      <article className="capacity-panel">
        <div className="panel-head"><div><p>TEAM CAPACITY</p><h2>기사·팀 업무량</h2></div></div>
        <div className="capacity-list">{techs.map(t=>{
          const rate=t.daily_capacity
            ?Math.min(100,Math.round((t.today_count/t.daily_capacity)*100))
            :0;
          return <div key={t.id} className={!t.is_active?'off':''}>
            <div><b>{t.name}</b><span>{t.region||'담당지역 미입력'}</span></div>
            <div className="capacity-meta"><strong>{t.today_count}/{t.daily_capacity}건</strong><small>잔여 {t.remaining_capacity}건</small></div>
            <div className="bar"><i style={{width:rate+'%'}}/></div>
          </div>;
        })}</div>
      </article>
    </section>

    {selected&&<div className="dispatch-backdrop" onClick={()=>setSelected(null)}>
      <div className="dispatch-modal" onClick={event=>event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p>AUTO DISPATCH</p>
            <h2>{selected.customer_name}</h2>
            <span>{regionInput||'지역 미입력'} · {addressInput||'주소 미입력'}</span>
          </div>
          <button onClick={()=>setSelected(null)}>×</button>
        </div>

        <section className="dispatch-location-grid">
          <label className="schedule-time">
            <span>지역</span>
            <input
              value={regionInput}
              placeholder="예: 고양시 덕양구"
              onChange={event=>{
                setRegionInput(event.target.value);
                setRecommend(null);
                setSelectedCandidate(null);
              }}
            />
          </label>
          <label className="schedule-time">
            <span>주소</span>
            <input
              value={addressInput}
              placeholder="예: 경기 고양시 덕양구 화정동"
              onChange={event=>{
                setAddressInput(event.target.value);
                setRecommend(null);
                setSelectedCandidate(null);
              }}
            />
          </label>
        </section>

        {(!regionInput||!addressInput)&&
          <p className="dispatch-warning">
            지역과 주소를 입력하면 담당 기사 추천 정확도가 높아집니다.
          </p>}

        <section className="dispatch-input-grid">
          <label className="schedule-time">
            <span>방문 일시</span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={event=>{
                setScheduledAt(event.target.value);
                setRecommend(null);
                setSelectedCandidate(null);
              }}
            />
          </label>
          <label className="schedule-time">
            <span>예상 소요시간</span>
            <select
              value={durationMinutes}
              onChange={event=>{
                setDurationMinutes(Number(event.target.value));
                setRecommend(null);
                setSelectedCandidate(null);
              }}
            >
              {[30,45,60,90,120,180].map(value=><option key={value} value={value}>{value}분</option>)}
            </select>
          </label>
        </section>

        <button
          className="calculate-button"
          type="button"
          onClick={calculateRecommend}
          disabled={loadingRecommend||!regionInput.trim()||!addressInput.trim()}
        >
          {loadingRecommend?'추천 계산 중…':'기사 추천 계산'}
        </button>

        {recommend&&<>
          <section className="recommend-summary">
            <small>추천 결과</small>
            <strong>{recommend.technician?.name||'배정 가능 기사 없음'}</strong>
            <p>{recommend.reason}</p>
          </section>

          <section className="candidate-list">
            {(recommend.candidates||[]).map((candidate:Candidate,index:number)=>
              <button
                type="button"
                key={candidate.id}
                disabled={!candidate.eligible}
                className={selectedCandidate?.id===candidate.id?'selected':''}
                onClick={()=>setSelectedCandidate(candidate)}
              >
                <div className="candidate-rank">{index+1}</div>
                <div className="candidate-main">
                  <div><b>{candidate.name}</b><span>{candidate.region||candidate.team_name||'담당지역 미입력'}</span></div>
                  <p>{candidate.reasons.join(' · ')}</p>
                </div>
                <div className="candidate-score">
                  <strong>{candidate.eligible?'추천':'제외'}</strong>
                  <small>{candidate.today_count}/{candidate.daily_capacity}건</small>
                </div>
              </button>
            )}
          </section>
        </>}

        <footer>
          <button className="cancel" onClick={()=>setSelected(null)}>취소</button>
          <button
            onClick={assign}
            disabled={!selectedCandidate||assigning||!regionInput.trim()||!addressInput.trim()}
          >
            {assigning?'배정 중…':selectedCandidate?`${selectedCandidate.name} 기사로 배정`:'기사를 선택하세요'}
          </button>
        </footer>
      </div>
    </div>}
  </div>;
}
