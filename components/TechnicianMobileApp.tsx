'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import TechnicianFieldReport from '@/components/TechnicianFieldReport';
import {normalizeScheduleKind} from '@/lib/scheduleKind';
import styles from './TechnicianMobileApp.module.css';

type Assignment={
  id:string;
  schedule_kind?:'service'|'rental_installation'|'rental_retrieval'|string;
  consultation_id?:string|null;
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
  completion_note?:string|null;
  completion_photo_urls?:string[]|null;
  departed_at?:string|null;
  arrival_at?:string|null;
  work_started_at?:string|null;
  completed_at?:string|null;
  report_approval_status?:string|null;
  report_rejection_reason?:string|null;
};

type Technician={
  id:string;
  name:string;
  phone?:string|null;
  region?:string|null;
  team_name?:string|null;
  is_active?:boolean;
};

type LocationPayload={
  latitude:number|null;
  longitude:number|null;
  accuracy:number|null;
};

const iso=(date=new Date())=>{
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,'0');
  const day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
};

const time=(value?:string|null)=>{
  if(!value) return '-';
  return new Date(value).toLocaleTimeString('ko-KR',{
    hour:'2-digit',
    minute:'2-digit',
  });
};

const shiftDate=(value:string,days:number)=>{
  const base=new Date(`${value}T12:00:00+09:00`);
  base.setDate(base.getDate()+days);
  return iso(base);
};

function scheduleTiming(item:Assignment,nowMs:number){
  const start=new Date(item.scheduled_at).getTime();
  const end=start+(item.duration_minutes||60)*60*1000;
  const minutes=Math.round((start-nowMs)/60000);

  if(item.status==='완료') return {label:'현장 처리 완료',tone:'done'};
  if(['이동중','방문중','작업중'].includes(item.status)){
    const elapsed=Math.max(0,Math.round((nowMs-start)/60000));
    return {label:`진행 ${elapsed}분`,tone:'active'};
  }
  if(nowMs>end) return {label:`${Math.max(1,Math.round((nowMs-start)/60000))}분 지연`,tone:'late'};
  if(minutes<=30&&minutes>=0) return {label:`${minutes}분 후 방문`,tone:'soon'};
  if(minutes>30) return {label:`${Math.floor(minutes/60)>0?`${Math.floor(minutes/60)}시간 `:''}${minutes%60}분 후`,tone:'upcoming'};
  return {label:'방문시간 도래',tone:'soon'};
}

const STATUS_ORDER=['배정대기','배정완료','이동중','방문중','작업중','완료'];

function approvalState(item:Assignment){
  if(item.status!=='완료') return null;
  const approval=item.report_approval_status||'검토대기';
  if(approval==='승인') return '승인완료';
  if(approval==='반려'){
    const reason=item.report_rejection_reason||'';
    if(/재방문|방문.*필요|현장.*확인/.test(reason)) return '재방문';
    return '반려';
  }
  return '승인대기';
}

function displayStatus(item:Assignment){
  return approvalState(item)||item.status;
}

function statusLabel(item:Assignment){
  const status=displayStatus(item);
  if(status==='배정대기') return '배정 대기';
  if(status==='배정완료') return '방문 예정';
  if(status==='방문중') return '현장 도착';
  if(status==='승인완료') return '최종 완료';
  if(status==='승인대기') return '승인 대기';
  if(status==='반려') return '반려 · 수정 필요';
  if(status==='재방문') return '재방문 요청';
  return status;
}

function nextActionLabel(item:Assignment){
  if(['배정대기','배정완료'].includes(item.status)) return '출발하기';
  if(item.status==='이동중') return '도착 처리';
  if(item.status==='방문중') return '작업 시작';
  if(item.status==='작업중') return '작업보고 작성';
  if(approvalState(item)==='반려') return '작업보고 수정';
  if(approvalState(item)==='재방문') return '재방문 내용 확인';
  return '작업보고 보기';
}

function jobKindLabel(item:Assignment){
  const scheduleKind=normalizeScheduleKind(item);
  if(scheduleKind==='rental_installation')return '렌탈 설치';
  if(scheduleKind==='rental_retrieval')return '렌탈 회수';
  return '';
}

export default function TechnicianMobileApp(){
  const router=useRouter();
  const [date,setDate]=useState(iso());
  const [technician,setTechnician]=useState<Technician|null>(null);
  const [items,setItems]=useState<Assignment[]>([]);
  const [message,setMessage]=useState('');
  const [checking,setChecking]=useState(true);
  const [loading,setLoading]=useState(false);
  const [workingId,setWorkingId]=useState<string|null>(null);
  const [reportScheduleId,setReportScheduleId]=useState<string|null>(null);
  const [isOnline,setIsOnline]=useState(true);
  const [nowMs,setNowMs]=useState(()=>Date.now());
  const [gpsState,setGpsState]=useState<'unknown'|'granted'|'denied'|'unsupported'>('unknown');

  async function checkSession(){
    try{
      const response=await fetch('/api/technician/me',{cache:'no-store'});
      const result=await response.json();

      if(response.status===401){
        router.replace('/technician/login');
        return;
      }

      if(!response.ok){
        setMessage(result.error||'로그인 확인 오류');
        return;
      }

      setTechnician(result.data);
    }catch(error){
      console.error('technician session error',error);
      setMessage('로그인 상태를 확인하지 못했습니다.');
    }finally{
      setChecking(false);
    }
  }

  async function loadAssignments(){
    if(!technician?.name) return;

    try{
      setLoading(true);
      setMessage('');

      const params=new URLSearchParams({date});
      const response=await fetch(
        `/api/technician/assignments?${params.toString()}`,
        {cache:'no-store'}
      );
      const result=await response.json();

      if(response.status===401){
        router.replace('/technician/login');
        return;
      }

      if(!response.ok){
        setMessage(result.error||'일정 조회 오류');
        return;
      }

      setItems(
        [...(result.data||[])].sort(
          (a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime()
        )
      );
    }catch(error){
      console.error('assignment load error',error);
      setMessage('일정을 불러오지 못했습니다.');
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{checkSession();},[]);
  useEffect(()=>{
    if(technician?.name) loadAssignments();
  },[date,technician?.name]);

  useEffect(()=>{
    setIsOnline(navigator.onLine);
    const online=()=>setIsOnline(true);
    const offline=()=>setIsOnline(false);
    window.addEventListener('online',online);
    window.addEventListener('offline',offline);

    const timer=window.setInterval(()=>setNowMs(Date.now()),60_000);

    if(!navigator.geolocation){
      setGpsState('unsupported');
    }else if('permissions' in navigator){
      navigator.permissions.query({name:'geolocation'}).then(result=>{
        setGpsState(result.state as 'granted'|'denied'|'unknown');
        result.onchange=()=>setGpsState(result.state as 'granted'|'denied'|'unknown');
      }).catch(()=>setGpsState('unknown'));
    }

    return ()=>{
      window.removeEventListener('online',online);
      window.removeEventListener('offline',offline);
      window.clearInterval(timer);
    };
  },[]);

  const summary=useMemo(()=>({
    total:items.length,
    waiting:items.filter(item=>['배정대기','배정완료'].includes(item.status)).length,
    active:items.filter(item=>['이동중','방문중','작업중'].includes(item.status)).length,
    approved:items.filter(item=>approvalState(item)==='승인완료').length,
    review:items.filter(item=>approvalState(item)==='승인대기').length,
    rejected:items.filter(item=>['반려','재방문'].includes(approvalState(item)||'')).length,
  }),[items]);

  const nextItem=useMemo(
    ()=>items.find(item=>item.status!=='완료')||
      items.find(item=>['반려','재방문'].includes(approvalState(item)||''))||null,
    [items]
  );

  const progress=summary.total===0?0:Math.round((summary.approved/summary.total)*100);

  async function logout(){
    try{
      await fetch('/api/technician/auth/logout',{method:'POST'});
    }finally{
      router.replace('/technician/login');
      router.refresh();
    }
  }

  function getLocation():Promise<LocationPayload>{
    return new Promise(resolve=>{
      if(!navigator.geolocation){
        setGpsState('unsupported');
        resolve({latitude:null,longitude:null,accuracy:null});
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position=>{
          setGpsState('granted');
          resolve({
            latitude:position.coords.latitude,
            longitude:position.coords.longitude,
            accuracy:position.coords.accuracy,
          });
        },
        error=>{
          if(error.code===error.PERMISSION_DENIED) setGpsState('denied');
          resolve({latitude:null,longitude:null,accuracy:null});
        },
        {
          enableHighAccuracy:true,
          timeout:8000,
          maximumAge:30000,
        }
      );
    });
  }

  async function updateStatus(
    item:Assignment,
    status:string,
    extra:Record<string,unknown>={}
  ){
    try{
      setWorkingId(item.id);
      setMessage('현재 위치를 확인하고 있습니다.');

      const location=await getLocation();
      const response=await fetch(`/api/technician/assignments/${item.id}`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status,...location,...extra}),
      });
      const result=await response.json();

      if(response.status===401){
        router.replace('/technician/login');
        return false;
      }

      if(!response.ok){
        setMessage(result.error||'상태 변경 오류');
        return false;
      }

      const locationText=location.latitude===null
        ? ' 위치정보 없이 저장되었습니다.'
        : ' GPS 위치도 함께 기록되었습니다.';

      setMessage(
        `${item.customer_name} 일정이 '${status}' 상태로 변경되었습니다.${locationText}`
      );
      await loadAssignments();
      return true;
    }catch(error){
      console.error('assignment status update error',error);
      setMessage('일정 상태를 변경하지 못했습니다.');
      return false;
    }finally{
      setWorkingId(null);
    }
  }

  async function runPrimaryAction(item:Assignment){
    if(['배정대기','배정완료'].includes(item.status)){
      await updateStatus(item,'이동중');
      return;
    }

    if(item.status==='이동중'){
      await updateStatus(item,'방문중');
      return;
    }

    if(item.status==='방문중'){
      await updateStatus(item,'작업중');
      return;
    }

    setReportScheduleId(item.id);
  }

  const mapUrl=(address?:string|null)=>
    `https://map.kakao.com/link/search/${encodeURIComponent(address||'')}`;

  if(checking){
    return (
      <main className={styles.loading}>
        <div className={styles.spinner}/>
        <p>로그인 상태를 확인하고 있습니다.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>RECHAIR FIELD</span>
            <h1>{technician?.name||'기사'}님, 오늘도 안전하게</h1>
            <p>{technician?.team_name||technician?.region||'현장 서비스팀'} 일정입니다.</p>
            <div className={styles.connectionRow}>
              <span data-ok={isOnline}>{isOnline?'온라인':'오프라인'}</span>
              <span data-ok={gpsState==='granted'}>
                {gpsState==='granted'?'GPS 허용':gpsState==='denied'?'GPS 차단':gpsState==='unsupported'?'GPS 미지원':'GPS 확인 중'}
              </span>
            </div>
          </div>

          <button className={styles.logout} type="button" onClick={logout}>
            로그아웃
          </button>
        </header>

        <section className={styles.toolbar}>
          <div className={styles.dateNavigator}>
            <button type="button" onClick={()=>setDate(shiftDate(date,-1))} aria-label="이전 날짜">‹</button>
            <label>
              <span>업무일</span>
              <input
                type="date"
                value={date}
                onChange={event=>setDate(event.target.value)}
              />
            </label>
            <button type="button" onClick={()=>setDate(shiftDate(date,1))} aria-label="다음 날짜">›</button>
          </div>
          <div className={styles.toolbarActions}>
            <button className={styles.todayButton} type="button" onClick={()=>setDate(iso())}>오늘</button>
            <button
              className={styles.refresh}
              type="button"
              onClick={loadAssignments}
              disabled={loading||!isOnline}
            >
              {loading?'불러오는 중':'새로고침'}
            </button>
          </div>
        </section>

        {!isOnline&&(
          <div className={styles.offlineNotice} role="alert">
            인터넷 연결이 끊겼습니다. 화면은 유지되지만 상태 저장은 연결 복구 후 진행해 주세요.
          </div>
        )}

        {message&&(
          <div className={styles.notice} role="status">
            {message}
          </div>
        )}

        <section className={styles.progressCard}>
          <div className={styles.progressTop}>
            <div>
              <span>오늘 진행률</span>
              <strong>{summary.approved} / {summary.total}건 최종 완료</strong>
            </div>
            <b>{progress}%</b>
          </div>

          <div className={styles.progressTrack}>
            <div style={{width:`${progress}%`}}/>
          </div>

          <div className={styles.summaryGrid}>
            <div><span>방문 대기</span><strong>{summary.waiting}</strong></div>
            <div><span>진행중</span><strong>{summary.active}</strong></div>
            <div><span>승인 대기</span><strong>{summary.review}</strong></div>
            <div><span>반려·재방문</span><strong>{summary.rejected}</strong></div>
            <div><span>최종 완료</span><strong>{summary.approved}</strong></div>
          </div>
        </section>

        {nextItem?(
          <section className={styles.heroCard}>
            <div className={styles.heroTop}>
              <div>
                <span className={styles.heroLabel}>다음 방문</span>
                {jobKindLabel(nextItem)&&<span className={styles.jobKind}>{jobKindLabel(nextItem)}</span>}
                <h2>{nextItem.customer_name} 고객</h2>
              </div>
              <div className={styles.heroBadges}>
                <span className={styles.timing} data-tone={scheduleTiming(nextItem,nowMs).tone}>
                  {scheduleTiming(nextItem,nowMs).label}
                </span>
                <span className={styles.status} data-status={displayStatus(nextItem)}>
                  {statusLabel(nextItem)}
                </span>
              </div>
            </div>

            <div className={styles.heroMeta}>
              <div>
                <span>방문시간</span>
                <strong>{time(nextItem.scheduled_at)}</strong>
              </div>
              <div>
                <span>예상시간</span>
                <strong>{nextItem.duration_minutes||60}분</strong>
              </div>
              <div>
                <span>서비스</span>
                <strong>{nextItem.service_type||'미입력'}</strong>
              </div>
            </div>

            <p className={styles.address}>
              {nextItem.address||nextItem.region||'주소가 입력되지 않았습니다.'}
            </p>

            {nextItem.memo&&(
              <p className={styles.memo}>{nextItem.memo}</p>
            )}

            <div className={styles.heroActions}>
              {nextItem.phone&&(
                <a className={styles.secondaryAction} href={`tel:${nextItem.phone}`}>
                  고객 전화
                </a>
              )}
              <a
                className={styles.secondaryAction}
                href={mapUrl(nextItem.address||nextItem.region)}
                target="_blank"
                rel="noreferrer"
              >
                지도 열기
              </a>
              <button
                className={styles.primaryAction}
                type="button"
                disabled={workingId===nextItem.id||!isOnline}
                onClick={()=>runPrimaryAction(nextItem)}
              >
                {workingId===nextItem.id?'처리 중…':nextActionLabel(nextItem)}
              </button>
            </div>
          </section>
        ):(
          <section className={styles.completeCard}>
            <span>✓</span>
            <h2>{summary.total===0?'배정된 일정이 없습니다.':'오늘 현장 방문이 모두 끝났습니다.'}</h2>
            <p>
              {summary.total===0
                ?'관리자가 일정을 배정하면 이 화면에 표시됩니다.'
                :'승인 대기·반려 건이 있는지 확인한 뒤 안전하게 복귀해 주세요.'}
            </p>
          </section>
        )}

        <section className={styles.scheduleSection}>
          <div className={styles.sectionTitle}>
            <div>
              <span>오늘 일정</span>
              <h2>방문 타임라인</h2>
            </div>
            <strong>{summary.total}건</strong>
          </div>

          {items.length===0?(
            <div className={styles.empty}>표시할 일정이 없습니다.</div>
          ):(
            <div className={styles.timeline}>
              {items.map((item,index)=>{
                const statusIndex=STATUS_ORDER.indexOf(item.status);
                const approval=approvalState(item);
                const isDone=approval==='승인완료';
                const isCurrent=item.id===nextItem?.id;

                return (
                  <article
                    className={`${styles.timelineItem} ${isCurrent?styles.currentItem:''}`}
                    key={item.id}
                  >
                    <div className={styles.timelineRail}>
                      <span className={isDone?styles.doneDot:styles.dot}>
                        {isDone?'✓':index+1}
                      </span>
                    </div>

                    <div className={styles.timelineCard}>
                      <div className={styles.cardTop}>
                        <div>
                          {jobKindLabel(item)&&<span className={styles.jobKind}>{jobKindLabel(item)}</span>}
                          <span className={styles.time}>{time(item.scheduled_at)}</span>
                          <h3>{item.customer_name}</h3>
                        </div>
                        <div className={styles.cardBadges}>
                          <span className={styles.timing} data-tone={scheduleTiming(item,nowMs).tone}>
                            {scheduleTiming(item,nowMs).label}
                          </span>
                          <span className={styles.status} data-status={displayStatus(item)}>
                            {statusLabel(item)}
                          </span>
                        </div>
                      </div>

                      <p className={styles.service}>
                        {item.service_type||'서비스 미입력'} · 예상 {item.duration_minutes||60}분
                      </p>
                      <p className={styles.cardAddress}>
                        {item.address||item.region||'주소 미입력'}
                      </p>

                      <div className={styles.history}>
                        <span className={statusIndex>=2?styles.historyDone:''}>
                          출발 {time(item.departed_at)}
                        </span>
                        <span className={statusIndex>=3?styles.historyDone:''}>
                          도착 {time(item.arrival_at)}
                        </span>
                        <span className={statusIndex>=4?styles.historyDone:''}>
                          작업 {time(item.work_started_at)}
                        </span>
                        <span className={item.status==='완료'?styles.historyDone:''}>
                          현장완료 {time(item.completed_at)}
                        </span>
                      </div>

                      {approval&&approval!=='승인완료'&&(
                        <div className={styles.reviewAlert} data-review={approval}>
                          <strong>{statusLabel(item)}</strong>
                          <p>{item.report_rejection_reason||(
                            approval==='승인대기'
                              ?'작업보고를 제출했으며 관리자 검토를 기다리고 있습니다.'
                              :'관리자 보완 요청을 확인해 주세요.'
                          )}</p>
                        </div>
                      )}

                      <div className={styles.cardActions}>
                        {item.phone&&(
                          <a href={`tel:${item.phone}`}>전화</a>
                        )}
                        <a
                          href={mapUrl(item.address||item.region)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          지도
                        </a>
                        <button
                          type="button"
                          disabled={workingId===item.id||!isOnline}
                          onClick={()=>runPrimaryAction(item)}
                        >
                          {workingId===item.id?'처리 중…':nextActionLabel(item)}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {reportScheduleId&&(
        <TechnicianFieldReport
          scheduleId={reportScheduleId}
          onClose={()=>{
            setReportScheduleId(null);
            loadAssignments();
          }}
        />
      )}
    </main>
  );
}
