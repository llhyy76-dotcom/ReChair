'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';

import TechnicianFieldReport from '@/components/TechnicianFieldReport';
import styles from './TechnicianMobileApp.module.css';

type Assignment={
  id:string;
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
  return new Date(value).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
};

const dateLabel=(value:string)=>{
  const target=new Date(`${value}T00:00:00`);
  return target.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
};

const statusTone=(status:string)=>{
  if(status==='완료') return styles.done;
  if(['이동중','방문중','작업중'].includes(status)) return styles.active;
  return styles.waiting;
};

export default function TechnicianMobileApp(){
  const router=useRouter();
  const [date,setDate]=useState(iso());
  const [technician,setTechnician]=useState<Technician|null>(null);
  const [items,setItems]=useState<Assignment[]>([]);
  const [message,setMessage]=useState('');
  const [checking,setChecking]=useState(true);
  const [workingId,setWorkingId]=useState<string|null>(null);
  const [reportScheduleId,setReportScheduleId]=useState<string|null>(null);
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const [scheduleOpen,setScheduleOpen]=useState(false);
  const [quickMenuOpen,setQuickMenuOpen]=useState(false);
  const [fieldModeOpen,setFieldModeOpen]=useState(false);

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
      setMessage('');
      const params=new URLSearchParams({date});
      const response=await fetch(`/api/technician/assignments?${params.toString()}`,{cache:'no-store'});
      const result=await response.json();
      if(response.status===401){
        router.replace('/technician/login');
        return;
      }
      if(!response.ok){
        setMessage(result.error||'일정 조회 오류');
        return;
      }
      setItems(result.data||[]);
    }catch(error){
      console.error('assignment load error',error);
      setMessage('일정을 불러오지 못했습니다.');
    }
  }

  useEffect(()=>{void checkSession();},[]);
  useEffect(()=>{if(technician?.name) void loadAssignments();},[date,technician?.name]);

  const sortedItems=useMemo(
    ()=>[...items].sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime()),
    [items]
  );

  const summary=useMemo(()=>({
    total:items.length,
    waiting:items.filter(item=>['배정대기','배정완료'].includes(item.status)).length,
    active:items.filter(item=>['이동중','방문중','작업중'].includes(item.status)).length,
    done:items.filter(item=>item.status==='완료').length,
  }),[items]);

  const nextItem=useMemo(
    ()=>sortedItems.find(item=>item.status!=='완료')||null,
    [sortedItems]
  );

  const activeItem=useMemo(
    ()=>sortedItems.find(item=>['이동중','방문중','작업중'].includes(item.status))||null,
    [sortedItems]
  );

  useEffect(()=>{
    if(activeItem){
      setFieldModeOpen(true);
    }else{
      setFieldModeOpen(false);
    }
  },[activeItem?.id,activeItem?.status]);

  const progress=summary.total===0?0:Math.round((summary.done/summary.total)*100);

  async function logout(){
    try{await fetch('/api/technician/auth/logout',{method:'POST'});}
    finally{
      router.replace('/technician/login');
      router.refresh();
    }
  }

  function getLocation():Promise<LocationPayload>{
    return new Promise(resolve=>{
      if(!navigator.geolocation){
        resolve({latitude:null,longitude:null,accuracy:null});
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position=>resolve({
          latitude:position.coords.latitude,
          longitude:position.coords.longitude,
          accuracy:position.coords.accuracy,
        }),
        ()=>resolve({latitude:null,longitude:null,accuracy:null}),
        {enableHighAccuracy:true,timeout:8000,maximumAge:30000}
      );
    });
  }

  async function updateStatus(item:Assignment,status:string,extra:Record<string,unknown>={}){
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
      const locationText=location.latitude===null?' 위치정보 없이 저장되었습니다.':' GPS 위치도 함께 기록되었습니다.';
      setMessage(`${item.customer_name} 일정이 '${status}' 상태로 변경되었습니다.${locationText}`);
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

  const mapUrl=(address?:string|null)=>`https://map.kakao.com/link/search/${encodeURIComponent(address||'')}`;

  function actionFor(item:Assignment,compact=false){
    const busy=workingId===item.id;
    if(['배정대기','배정완료'].includes(item.status)){
      return <button className={`${styles.primaryAction} ${compact?styles.compactAction:''}`} disabled={busy} onClick={()=>updateStatus(item,'이동중')}>{busy?'처리 중':'출발하기'}</button>;
    }
    if(item.status==='이동중'){
      return <button className={`${styles.primaryAction} ${compact?styles.compactAction:''}`} disabled={busy} onClick={()=>updateStatus(item,'방문중')}>{busy?'처리 중':'도착하기'}</button>;
    }
    if(item.status==='방문중'){
      return <button className={`${styles.primaryAction} ${compact?styles.compactAction:''}`} disabled={busy} onClick={()=>updateStatus(item,'작업중')}>{busy?'처리 중':'작업 시작'}</button>;
    }
    if(item.status==='작업중'){
      return <button className={styles.primaryAction} onClick={()=>setReportScheduleId(item.id)}>작업보고 작성</button>;
    }
    if(item.status==='완료'){
      return <button className={`${styles.secondaryAction} ${compact?styles.compactAction:''}`} onClick={()=>setReportScheduleId(item.id)}>작업보고 보기</button>;
    }
    return null;
  }

  if(checking){
    return <div className={styles.loading}>로그인 상태를 확인하고 있습니다.</div>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>RECHAIR FIELD</p>
          <h1>{technician?.name} 기사님</h1>
          <span>{technician?.team_name||technician?.region||'오늘도 안전하게 업무하세요.'}</span>
        </div>
        <button type="button" className={styles.logout} onClick={logout}>로그아웃</button>
      </header>

      <main className={styles.main}>
        <section className={styles.dateBar}>
          <label>
            <span>업무일</span>
            <input type="date" value={date} onChange={event=>setDate(event.target.value)}/>
          </label>
          <button type="button" onClick={()=>void loadAssignments()} aria-label="일정 새로고침">새로고침</button>
        </section>

        {message&&<aside className={styles.notice}>{message}</aside>}

        <section className={styles.progressCard}>
          <div className={styles.progressTop}>
            <div>
              <span>{dateLabel(date)}</span>
              <strong>오늘 업무 {summary.done} / {summary.total}건 완료</strong>
            </div>
            <b>{progress}%</b>
          </div>
          <div className={styles.progressTrack}><i style={{width:`${progress}%`}}/></div>
          <div className={styles.stats}>
            <span><b>{summary.waiting}</b> 대기</span>
            <span><b>{summary.active}</b> 진행</span>
            <span><b>{summary.done}</b> 완료</span>
          </div>
        </section>

        {nextItem&&(
          <section className={styles.nextCard}>
            <div className={styles.sectionLabel}>지금 해야 할 일정</div>
            <div className={styles.nextHead}>
              <div>
                <time>{time(nextItem.scheduled_at)}</time>
                <h2>{nextItem.customer_name}</h2>
              </div>
              <span className={`${styles.status} ${statusTone(nextItem.status)}`}>{nextItem.status}</span>
            </div>
            <p className={styles.service}>{nextItem.service_type||'서비스 미입력'} · 예상 {nextItem.duration_minutes||60}분</p>
            <address>{nextItem.address||nextItem.region||'주소 미입력'}</address>
            {nextItem.memo&&<p className={styles.memo}>{nextItem.memo}</p>}
            <div className={styles.quickActions}>
              <a className={!nextItem.phone?styles.disabledLink:''} href={nextItem.phone?`tel:${nextItem.phone}`:undefined}>전화</a>
              <a href={mapUrl(nextItem.address||nextItem.region)} target="_blank" rel="noreferrer">길찾기</a>
            </div>
            {actionFor(nextItem)}
          </section>
        )}

        <section className={styles.scheduleSection}>
          <button type="button" className={styles.scheduleToggle} onClick={()=>setScheduleOpen(value=>!value)} aria-expanded={scheduleOpen}>
            <span>
              <small>오늘 일정</small>
              <strong>전체 방문 순서</strong>
            </span>
            <span className={styles.scheduleCount}>{summary.total}건 {scheduleOpen?'접기':'보기'}</span>
          </button>

          {scheduleOpen&&(
            sortedItems.length===0?(
              <div className={styles.empty}>
                <b>배정된 일정이 없습니다.</b>
                <p>관리자가 일정을 배정하면 이곳에 표시됩니다.</p>
              </div>
            ):(
              <div className={styles.list}>
                {sortedItems.map((item,index)=>{
                  const expanded=expandedId===item.id;
                  const isNext=nextItem?.id===item.id;
                  return (
                    <article key={item.id} className={`${styles.scheduleCard} ${isNext?styles.currentCard:''}`}>
                      <button type="button" className={styles.cardSummary} onClick={()=>setExpandedId(expanded?null:item.id)}>
                        <span className={styles.order}>{index+1}</span>
                        <span className={styles.cardMain}>
                          <span className={styles.cardTop}>
                            <time>{time(item.scheduled_at)}</time>
                            <i className={`${styles.status} ${statusTone(item.status)}`}>{item.status}</i>
                          </span>
                          <strong>{item.customer_name}</strong>
                          <small>{item.service_type||'서비스 미입력'} · {item.region||'지역 미입력'}</small>
                        </span>
                        <span className={styles.chevron}>{expanded?'⌃':'⌄'}</span>
                      </button>

                      {expanded&&(
                        <div className={styles.cardDetail}>
                          <address>{item.address||item.region||'주소 미입력'}</address>
                          {item.memo&&<p className={styles.memo}>{item.memo}</p>}
                          <div className={styles.timeline}>
                            <span>출발 <b>{time(item.departed_at)}</b></span>
                            <span>도착 <b>{time(item.arrival_at)}</b></span>
                            <span>작업 <b>{time(item.work_started_at)}</b></span>
                            <span>완료 <b>{time(item.completed_at)}</b></span>
                          </div>
                          <div className={styles.quickActions}>
                            <a className={!item.phone?styles.disabledLink:''} href={item.phone?`tel:${item.phone}`:undefined}>전화</a>
                            <a href={mapUrl(item.address||item.region)} target="_blank" rel="noreferrer">길찾기</a>
                          </div>
                          {actionFor(item)}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )
          )}
        </section>
      </main>

      {activeItem&&fieldModeOpen&&(
        <section className={styles.fieldMode} aria-label="현장 모드">
          <div className={styles.fieldModeHandle}/>
          <div className={styles.fieldModeTop}>
            <span className={styles.fieldModeLabel}>현장 모드 · {activeItem.status}</span>
            <button type="button" onClick={()=>setFieldModeOpen(false)}>최소화</button>
          </div>
          <div className={styles.fieldCustomer}>
            <time>{time(activeItem.scheduled_at)}</time>
            <h2>{activeItem.customer_name}</h2>
            <p>{activeItem.service_type||'서비스 미입력'}</p>
            <address>{activeItem.address||activeItem.region||'주소 미입력'}</address>
          </div>
          {activeItem.memo&&<p className={styles.fieldMemo}>{activeItem.memo}</p>}
          <div className={styles.fieldQuick}>
            <a className={!activeItem.phone?styles.disabledLink:''} href={activeItem.phone?`tel:${activeItem.phone}`:undefined}>고객 전화</a>
            <a href={mapUrl(activeItem.address||activeItem.region)} target="_blank" rel="noreferrer">길찾기</a>
          </div>
          {actionFor(activeItem,true)}
        </section>
      )}

      {activeItem&&!fieldModeOpen&&(
        <button type="button" className={styles.fieldModeRestore} onClick={()=>setFieldModeOpen(true)}>현장 모드 열기</button>
      )}

      {nextItem&&(
        <div className={styles.fabWrap}>
          {quickMenuOpen&&(
            <div className={styles.fabMenu}>
              <button type="button" onClick={()=>{setReportScheduleId(nextItem.id);setQuickMenuOpen(false);}}>작업보고</button>
              <a className={!nextItem.phone?styles.disabledLink:''} href={nextItem.phone?`tel:${nextItem.phone}`:undefined}>고객전화</a>
              <a href={mapUrl(nextItem.address||nextItem.region)} target="_blank" rel="noreferrer">길찾기</a>
            </div>
          )}
          <button type="button" className={styles.fab} aria-label="빠른 작업" aria-expanded={quickMenuOpen} onClick={()=>setQuickMenuOpen(value=>!value)}>{quickMenuOpen?'×':'+'}</button>
        </div>
      )}

      <nav className={styles.bottomNav} aria-label="기사 메뉴">
        <button type="button" className={styles.navActive}><span>⌂</span>홈</button>
        <button type="button" onClick={()=>{setScheduleOpen(true);setTimeout(()=>document.querySelector(`.${styles.scheduleSection}`)?.scrollIntoView({behavior:'smooth'}),0);}}><span>▣</span>일정</button>
        <button type="button" onClick={()=>nextItem&&setReportScheduleId(nextItem.id)} disabled={!nextItem}><span>✎</span>보고</button>
        <button type="button" onClick={logout}><span>○</span>내정보</button>
      </nav>

      {reportScheduleId&&(
        <TechnicianFieldReport
          scheduleId={reportScheduleId}
          onClose={()=>{
            setReportScheduleId(null);
            void loadAssignments();
          }}
        />
      )}
    </div>
  );
}
