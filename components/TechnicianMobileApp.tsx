'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import TechnicianFieldReport from '@/components/TechnicianFieldReport';

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
  if(!value){
    return '-';
  }

  return new Date(value).toLocaleTimeString('ko-KR',{
    hour:'2-digit',
    minute:'2-digit',
  });
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

  async function checkSession(){
    try{
      const response=await fetch('/api/technician/me',{
        cache:'no-store',
      });

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
    if(!technician?.name){
      return;
    }

    try{
      setMessage('');

      const params=new URLSearchParams({
        date,
      });

      const response=await fetch(
        `/api/technician/assignments?${params.toString()}`,
        {
          cache:'no-store',
        }
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

      setItems(result.data||[]);
    }catch(error){
      console.error('assignment load error',error);
      setMessage('일정을 불러오지 못했습니다.');
    }
  }

  useEffect(()=>{
    checkSession();
  },[]);

  useEffect(()=>{
    if(technician?.name){
      loadAssignments();
    }
  },[date,technician?.name]);

  const summary=useMemo(()=>({
    total:items.length,

    waiting:items.filter(item=>
      ['배정대기','배정완료'].includes(item.status)
    ).length,

    active:items.filter(item=>
      ['이동중','방문중','작업중'].includes(item.status)
    ).length,

    done:items.filter(item=>
      item.status==='완료'
    ).length,
  }),[items]);

  async function logout(){
    try{
      await fetch('/api/technician/auth/logout',{
        method:'POST',
      });
    }finally{
      router.replace('/technician/login');
      router.refresh();
    }
  }

  function getLocation():Promise<LocationPayload>{
    return new Promise(resolve=>{
      if(!navigator.geolocation){
        resolve({
          latitude:null,
          longitude:null,
          accuracy:null,
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position=>{
          resolve({
            latitude:position.coords.latitude,
            longitude:position.coords.longitude,
            accuracy:position.coords.accuracy,
          });
        },
        ()=>{
          resolve({
            latitude:null,
            longitude:null,
            accuracy:null,
          });
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

      const response=await fetch(
        `/api/technician/assignments/${item.id}`,
        {
          method:'PATCH',
          headers:{
            'Content-Type':'application/json',
          },
          body:JSON.stringify({
            status,
            ...location,
            ...extra,
          }),
        }
      );

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

  const mapUrl=(address?:string|null)=>{
    return `https://map.kakao.com/link/search/${encodeURIComponent(
      address||''
    )}`;
  };

  if(checking){
    return (
      <div className="tech-mobile-loading">
        로그인 상태를 확인하고 있습니다.
      </div>
    );
  }

  return (
    <div className="tech-mobile">
      <header>
        <div>
          <p>RECHAIR FIELD</p>
          <h1>오늘의 방문 일정</h1>
          <span>{technician?.name} 전용 일정입니다.</span>
        </div>

        <div className="field-account">
          <b>{technician?.name}</b>
          <button type="button" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>

      <section className="mobile-controls auth-controls">
        <label>
          <span>일자</span>

          <input
            type="date"
            value={date}
            onChange={event=>setDate(event.target.value)}
          />
        </label>

        <button type="button" onClick={loadAssignments}>
          새로고침
        </button>
      </section>

      {message&&(
        <aside>
          {message}
        </aside>
      )}

      <section className="mobile-summary">
        <article>
          <small>전체</small>
          <strong>{summary.total}</strong>
        </article>

        <article>
          <small>대기</small>
          <strong>{summary.waiting}</strong>
        </article>

        <article>
          <small>진행중</small>
          <strong>{summary.active}</strong>
        </article>

        <article className="dark">
          <small>완료</small>
          <strong>{summary.done}</strong>
        </article>
      </section>

      <section className="assignment-list">
        {items.length===0?(
          <div className="empty">
            <b>배정된 일정이 없습니다.</b>

            <p>
              관리자가 {technician?.name}에 일정을 배정하면 표시됩니다.
            </p>
          </div>
        ):(
          items.map((item,index)=>(
            <article key={item.id}>
              <div className="visit-order">
                {index+1}
              </div>

              <div className="visit-main">
                <div className="visit-head">
                  <time>
                    {time(item.scheduled_at)}
                  </time>

                  <span className={`status ${item.status}`}>
                    {item.status}
                  </span>
                </div>

                <h2>{item.customer_name}</h2>

                <p>
                  {item.service_type||'서비스 미입력'}
                  {' · '}
                  예상 {item.duration_minutes||60}분
                </p>

                <address>
                  {item.address||item.region||'주소 미입력'}
                </address>

                {item.memo&&(
                  <blockquote>
                    {item.memo}
                  </blockquote>
                )}

                <div className="workflow-times">
                  <span>
                    출발 <b>{time(item.departed_at)}</b>
                  </span>

                  <span>
                    도착 <b>{time(item.arrival_at)}</b>
                  </span>

                  <span>
                    작업 <b>{time(item.work_started_at)}</b>
                  </span>

                  <span>
                    완료 <b>{time(item.completed_at)}</b>
                  </span>
                </div>

                <div className="quick-links">
                  <a href={`tel:${item.phone||''}`}>
                    고객 전화
                  </a>

                  <a
                    href={mapUrl(item.address||item.region)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    지도 열기
                  </a>
                </div>
              </div>

              <div className="status-actions workflow-actions">
                {['배정대기','배정완료'].includes(item.status)&&(
                  <button
                    type="button"
                    disabled={workingId===item.id}
                    onClick={()=>updateStatus(item,'이동중')}
                  >
                    {workingId===item.id?'처리 중':'출발'}
                  </button>
                )}

                {item.status==='이동중'&&(
                  <button
                    type="button"
                    disabled={workingId===item.id}
                    onClick={()=>updateStatus(item,'방문중')}
                  >
                    {workingId===item.id?'처리 중':'도착'}
                  </button>
                )}

                {item.status==='방문중'&&(
                  <button
                    type="button"
                    disabled={workingId===item.id}
                    onClick={()=>updateStatus(item,'작업중')}
                  >
                    {workingId===item.id?'처리 중':'작업 시작'}
                  </button>
                )}

                {item.status==='작업중'&&(
                  <button
                    type="button"
                    className="complete"
                    onClick={()=>setReportScheduleId(item.id)}
                  >
                    현장 작업보고
                  </button>
                )}

                {item.status==='완료'&&(
                  <button
                    type="button"
                    className="done"
                    onClick={()=>setReportScheduleId(item.id)}
                  >
                    작업보고 보기
                  </button>
                )}
              </div>
            </article>
          ))
        )}
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
    </div>
  );
}
