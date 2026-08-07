'use client';
import {useEffect,useState} from 'react';

const STATUS=['신규','상담중','견적발송','예약완료','방문완료','판매완료','종료'];
const SERVICE=['전체','중고구매','중고판매','이전설치','폐기수거','출장수리','부품구매'];

function detectRegion(address:string){
  const text=String(address||'').trim();
  if(!text)return '';
  const normalized=text.replace(/\s+/g,' ');
  const patterns=[
    /서울(?:특별시|시)?\s+([가-힣]+구)/,
    /(?:경기도|경기)\s+([가-힣]+시)\s+([가-힣]+구)/,
    /(?:경기도|경기)\s+([가-힣]+시)/,
    /([가-힣]+시)\s+([가-힣]+구)/,
    /([가-힣]+시)/,
    /([가-힣]+군)/,
    /([가-힣]+구)/,
  ];
  for(const p of patterns){
    const m=normalized.match(p);
    if(m){
      if(m[2])return `${m[1]} ${m[2]}`;
      return m[1]||'';
    }
  }
  return '';
}

export default function AdminConsultationsCRM(){
 const [rows,setRows]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[status,setStatus]=useState('전체'),[service,setService]=useState('전체'),[q,setQ]=useState(''),[message,setMessage]=useState(''),[scheduleOpen,setScheduleOpen]=useState(false);
 const [schedule,setSchedule]=useState({scheduled_at:'',assignee:'',duration_minutes:60,region:'',address:'',memo:''});
 async function load(){const p=new URLSearchParams();if(status!=='전체')p.set('status',status);if(service!=='전체')p.set('service',service);if(q.trim())p.set('q',q.trim());const r=await fetch('/api/admin/consultations?'+p.toString(),{cache:'no-store'});const j=await r.json();if(!r.ok){setMessage(j.error||'조회 오류');return;}setRows(j.data||[]);if(selected){const f=(j.data||[]).find((x:any)=>x.id===selected.id);if(f)setSelected(f)}}
 useEffect(()=>{load()},[status,service]);
 async function save(){if(!selected)return;const r=await fetch('/api/admin/consultations/'+selected.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(selected)});const j=await r.json();if(!r.ok){setMessage(j.error||'저장 오류');return;}setSelected(j.data);setMessage('상담 정보가 저장되었습니다.');load()}
 function openSchedule(){setSchedule({scheduled_at:selected?.next_action_at?selected.next_action_at.slice(0,16):'',assignee:selected?.assignee||'',duration_minutes:60,region:selected?.region||detectRegion(selected?.address||''),address:selected?.address||'',memo:selected?.memo||''});setScheduleOpen(true)}
 async function createSchedule(){if(!selected)return;if(!schedule.scheduled_at){setMessage('방문 일시를 입력해 주세요.');return;}if(!schedule.address.trim()){setMessage('방문 주소를 입력해 주세요.');return;}const resolvedRegion=schedule.region.trim()||detectRegion(schedule.address);if(!resolvedRegion){setMessage('지역을 자동 인식하지 못했습니다. 지역을 직접 입력해 주세요.');return;}const r=await fetch('/api/admin/consultations/'+selected.id+'/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...schedule,region:resolvedRegion})});const j=await r.json();if(!r.ok){setMessage(j.error||'일정 생성 오류');return;}setMessage('AS 일정이 생성되었습니다.');setScheduleOpen(false);load()}
 const patch=(k:string,v:any)=>setSelected((s:any)=>({...s,[k]:v}));
 const applyRegionFromAddress=()=>{if(!selected)return;const region=detectRegion(selected.address||'');if(region){patch('region',region);setMessage(`주소에서 지역을 '${region}'(으)로 자동 인식했습니다.`)}else setMessage('주소에서 지역을 찾지 못했습니다. 예: 경기도 고양시 덕양구 화정동');};
 const photos=selected?[['앞면',selected.photo_front_url],['측면',selected.photo_side_url],['라벨',selected.photo_label_url],['후면',selected.photo_back_url]]:[];
 return <div className="crm"><header><div><p>RECHAIR ADMIN</p><h1>상담 CRM</h1><span>상담 접수부터 일정 배정과 완료까지 관리합니다.</span></div><div className="crm-top-links"><a href="/admin/dashboard">운영 대시보드</a><a href="/admin/schedule">AS 일정</a></div></header>
 <div className="toolbar"><div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="이름, 연락처, 지역, 모델명 검색" onKeyDown={e=>e.key==='Enter'&&load()}/><button onClick={load}>검색</button></div><select value={service} onChange={e=>setService(e.target.value)}>{SERVICE.map(v=><option key={v}>{v}</option>)}</select></div>
 <nav><button className={status==='전체'?'on':''} onClick={()=>setStatus('전체')}>전체</button>{STATUS.map(v=><button className={status===v?'on':''} onClick={()=>setStatus(v)} key={v}>{v}</button>)}</nav>{message&&<aside>{message}</aside>}
 <main><section className="list">{rows.length?rows.map(r=><button className={selected?.id===r.id?'on':''} onClick={()=>setSelected(r)} key={r.id}><div><b>{r.customer_name||'이름 없음'}</b><span>{r.phone}</span><em>{r.region||'지역 미입력'}</em></div><div><strong>{r.service_type}</strong><small>{r.status}</small></div></button>):<p>조건에 맞는 상담이 없습니다.</p>}</section>
 <section className="detail">{!selected?<div className="empty"><b>상담을 선택하세요.</b><p>왼쪽 목록에서 상담을 선택합니다.</p></div>:<><div className="title"><div><p>{selected.service_type}</p><h2>{selected.customer_name}</h2><span>{selected.phone} · {selected.region||'지역 미입력'}</span></div><div className="title-actions"><a href={'tel:'+(selected.phone||'')}>전화하기</a><button onClick={openSchedule}>AS 일정 생성</button></div></div>
 <div className="location-card"><div className="location-card-head"><div><b>방문 위치</b><span>AI 자동배정은 이 주소와 지역을 사용합니다.</span></div><button type="button" onClick={applyRegionFromAddress}>지역 자동인식</button></div><label><span>전체 주소</span><input value={selected.address||''} onChange={e=>{const address=e.target.value;patch('address',address);const region=detectRegion(address);if(region)patch('region',region)}} placeholder="예: 경기도 고양시 덕양구 화정로 00"/></label><label><span>지역</span><input value={selected.region||''} onChange={e=>patch('region',e.target.value)} placeholder="주소 입력 시 자동 입력됩니다. 예: 고양시 덕양구"/></label><small>주소만 정확하게 입력하면 지역은 자동으로 인식됩니다. 필요할 때만 지역을 직접 수정하세요.</small></div>
 <div className="schedule-summary"><div><span>등록 일정</span><b>{selected.schedule_count||0}건</b></div><div><span>다음 일정</span><b>{selected.next_action_at?new Date(selected.next_action_at).toLocaleString('ko-KR'):'-'}</b></div><a href={'/admin/schedule?consultation_id='+selected.id}>일정 보기 ›</a></div>
 <div className="fields"><label><span>처리상태</span><select value={selected.status} onChange={e=>patch('status',e.target.value)}>{STATUS.map(v=><option key={v}>{v}</option>)}</select></label><label><span>담당자</span><input value={selected.assignee||''} onChange={e=>patch('assignee',e.target.value)}/></label><label><span>견적금액</span><input type="number" value={selected.estimate_amount||0} onChange={e=>patch('estimate_amount',Number(e.target.value))}/></label><label><span>다음 일정</span><input type="datetime-local" value={selected.next_action_at?selected.next_action_at.slice(0,16):''} onChange={e=>patch('next_action_at',e.target.value||null)}/></label></div>
 <div className="product"><div><span>브랜드</span><b>{selected.brand||'-'}</b></div><div><span>모델명</span><b>{selected.model_name||'-'}</b></div><div><span>연결상품</span><b>{selected.product_title||'-'}</b></div></div><label className="memo"><span>관리자 메모</span><textarea value={selected.memo||''} onChange={e=>patch('memo',e.target.value)} placeholder="통화내용과 후속조치를 기록하세요."/></label><div className="photos">{photos.map(([n,u])=><div key={n}><b>{n}</b>{u?<a href={u} target="_blank"><img src={u} alt={n}/></a>:<p>사진 없음</p>}</div>)}</div><footer><button onClick={save}>변경사항 저장</button></footer></>}</section></main>
 {scheduleOpen&&selected&&<div className="crm-schedule-backdrop" onClick={()=>setScheduleOpen(false)}><div className="crm-schedule-modal" onClick={e=>e.stopPropagation()}><div className="crm-schedule-head"><div><p>CREATE SCHEDULE</p><h2>AS 일정 생성</h2><span>{selected.customer_name} · {selected.phone}</span></div><button onClick={()=>setScheduleOpen(false)}>×</button></div><div className="crm-schedule-fields"><label><span>방문 일시</span><input type="datetime-local" value={schedule.scheduled_at} onChange={e=>setSchedule({...schedule,scheduled_at:e.target.value})}/></label><label><span>담당자</span><input value={schedule.assignee} onChange={e=>setSchedule({...schedule,assignee:e.target.value})}/></label><label><span>예상 소요시간</span><input type="number" min="10" step="10" value={schedule.duration_minutes} onChange={e=>setSchedule({...schedule,duration_minutes:Number(e.target.value)})}/></label><label><span>방문 주소</span><input value={schedule.address} onChange={e=>{const address=e.target.value;setSchedule(s=>({...s,address,region:s.region||detectRegion(address)}))}}/></label><label><span>지역</span><input value={schedule.region} onChange={e=>setSchedule({...schedule,region:e.target.value})} placeholder="예: 고양시 덕양구"/></label></div><label className="crm-schedule-memo"><span>일정 메모</span><textarea value={schedule.memo} onChange={e=>setSchedule({...schedule,memo:e.target.value})}/></label><footer><button className="cancel" onClick={()=>setScheduleOpen(false)}>취소</button><button onClick={createSchedule}>일정 생성</button></footer></div></div>}</div>}
