'use client';

import {useEffect,useState} from 'react';

type Photo={
  id:string;
  photo_type:string;
  photo_url:string;
  created_at?:string|null;
};

type AdminReport={
  id:string;
  consultation_id?:string|null;
  customer_name?:string|null;
  phone?:string|null;
  address?:string|null;
  region?:string|null;
  service_type?:string|null;
  assignee?:string|null;
  scheduled_at?:string|null;
  duration_minutes?:number|null;
  status?:string|null;
  memo?:string|null;

  symptom_text?:string|null;
  action_text?:string|null;
  replaced_parts?:string|null;
  customer_confirmation?:string|null;
  customer_signature_url?:string|null;

  departed_at?:string|null;
  arrival_at?:string|null;
  work_started_at?:string|null;
  completed_at?:string|null;
  field_report_updated_at?:string|null;

  service_schedule_photos?:Photo[];
};

const photoLabels:Record<string,string>={
  front:'제품 정면',
  side:'제품 측면',
  label:'제품 라벨',
  after:'작업 후',
  part:'교체 부품',
  receipt:'영수증',
  other:'기타 사진',
};

function formatDateTime(value?:string|null){
  if(!value){
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR',{
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
  });
}

function text(value?:string|null){
  return value?.trim()||'기록 없음';
}

export default function AdminFieldReport({
  scheduleId,
  onClose,
}:{
  scheduleId:string;
  onClose:()=>void;
}){
  const [report,setReport]=useState<AdminReport|null>(null);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');

  async function load(){
    try{
      setLoading(true);
      setMessage('');

      const response=await fetch(
        `/api/admin/schedules/${scheduleId}/report`,
        {
          cache:'no-store',
        }
      );

      const contentType=
        response.headers.get('content-type')||'';

      const result=contentType.includes('application/json')
        ? await response.json()
        : {
            error:await response.text(),
          };

      if(!response.ok){
        setMessage(
          result.error||
          '작업보고를 불러오지 못했습니다.'
        );
        return;
      }

      setReport(result.data);
    }catch(error){
      console.error('admin report load error',error);
      setMessage('작업보고 조회 요청에 실패했습니다.');
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    void load();
  },[scheduleId]);

  const photos=report?.service_schedule_photos||[];

  return (
    <div
      className="admin-report-backdrop"
      onClick={onClose}
    >
      <div
        className="admin-report-panel"
        onClick={event=>event.stopPropagation()}
      >
        <header className="admin-report-header">
          <div>
            <p>RECHAIR SERVICE REPORT</p>
            <h2>
              {report?.customer_name||
                'AS 작업보고'}
            </h2>

            <span>
              {report?.service_type||
                '서비스 정보 없음'}
            </span>
          </div>

          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {message&&(
          <aside className="admin-report-message">
            {message}
          </aside>
        )}

        {loading?(
          <div className="admin-report-loading">
            작업보고를 불러오고 있습니다.
          </div>
        ):report?(
          <>
            <section className="admin-report-summary">
              <article>
                <small>담당 기사</small>
                <strong>
                  {report.assignee||'-'}
                </strong>
              </article>

              <article>
                <small>방문일</small>
                <strong>
                  {formatDateTime(
                    report.scheduled_at
                  )}
                </strong>
              </article>

              <article>
                <small>처리 상태</small>
                <strong>
                  {report.status||'-'}
                </strong>
              </article>

              <article>
                <small>고객 연락처</small>
                <strong>
                  {report.phone||'-'}
                </strong>
              </article>
            </section>

            <section className="admin-report-address">
              <small>방문 주소</small>
              <p>
                {report.address||
                  report.region||
                  '주소 정보 없음'}
              </p>
            </section>

            <section className="admin-report-workflow">
              <article>
                <small>출발</small>
                <strong>
                  {formatDateTime(
                    report.departed_at
                  )}
                </strong>
              </article>

              <article>
                <small>도착</small>
                <strong>
                  {formatDateTime(
                    report.arrival_at
                  )}
                </strong>
              </article>

              <article>
                <small>작업 시작</small>
                <strong>
                  {formatDateTime(
                    report.work_started_at
                  )}
                </strong>
              </article>

              <article>
                <small>완료</small>
                <strong>
                  {formatDateTime(
                    report.completed_at
                  )}
                </strong>
              </article>
            </section>

            <section className="admin-report-text-grid">
              <article>
                <h3>고객 증상</h3>
                <p>
                  {text(report.symptom_text)}
                </p>
              </article>

              <article>
                <h3>조치 내용</h3>
                <p>
                  {text(report.action_text)}
                </p>
              </article>

              <article>
                <h3>교체 부품</h3>
                <p>
                  {text(report.replaced_parts)}
                </p>
              </article>

              <article>
                <h3>고객 확인사항</h3>
                <p>
                  {text(
                    report.customer_confirmation
                  )}
                </p>
              </article>
            </section>

            <section className="admin-report-photos">
              <h3>현장 사진</h3>

              {photos.length===0?(
                <div className="admin-report-empty">
                  등록된 현장 사진이 없습니다.
                </div>
              ):(
                <div className="admin-report-photo-grid">
                  {photos.map(photo=>(
                    <article key={photo.id}>
                      <b>
                        {photoLabels[
                          photo.photo_type
                        ]||photo.photo_type}
                      </b>

                      <a
                        href={photo.photo_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={photo.photo_url}
                          alt={
                            photoLabels[
                              photo.photo_type
                            ]||'현장 사진'
                          }
                        />
                      </a>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-report-signature">
              <h3>고객 서명</h3>

              {report.customer_signature_url?(
                <a
                  href={
                    report.customer_signature_url
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={
                      report.customer_signature_url
                    }
                    alt="고객 서명"
                  />
                </a>
              ):(
                <div className="admin-report-empty">
                  등록된 고객 서명이 없습니다.
                </div>
              )}
            </section>

            <footer className="admin-report-footer">
              <span>
                최근 보고서 수정:
                {' '}
                {formatDateTime(
                  report.field_report_updated_at
                )}
              </span>

              <button
                type="button"
                onClick={onClose}
              >
                닫기
              </button>
            </footer>
          </>
        ):null}
      </div>
    </div>
  );
}
