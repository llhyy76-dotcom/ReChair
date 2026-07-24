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
  report_approval_status?:string|null;
  report_rejection_reason?:string|null;
  report_reviewed_at?:string|null;
  report_reviewed_by?:string|null;
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
  onUpdated,
}: {
  scheduleId: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [report,setReport]=useState<AdminReport|null>(null);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [reviewing,setReviewing]=useState(false);
  const [rejectionReason,setRejectionReason]=useState('');
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
      setRejectionReason(
  result.data.report_rejection_reason||''
);
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
  async function reviewReport(
  approvalStatus:'승인'|'반려'|'검토대기'
){
  if(
    approvalStatus==='반려'&&
    !rejectionReason.trim()
  ){
    setMessage('반려 사유를 입력하세요.');
    return;
  }

  const confirmMessage=
    approvalStatus==='승인'
      ? '이 작업보고를 승인하시겠습니까?'
      : approvalStatus==='반려'
        ? '이 작업보고를 기사에게 반려하시겠습니까?'
        : '검토대기 상태로 되돌리시겠습니까?';

  if(!window.confirm(confirmMessage)){
    return;
  }

  try{
    setReviewing(true);
    setMessage('작업보고 검토 상태를 저장하고 있습니다.');

    const response=await fetch(
      `/api/admin/schedules/${scheduleId}/report/review`,
      {
        method:'PATCH',
        headers:{
          'Content-Type':'application/json',
        },
        body:JSON.stringify({
          approval_status:approvalStatus,
          rejection_reason:
            approvalStatus==='반려'
              ? rejectionReason.trim()
              : '',
        }),
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
        '작업보고 검토 처리 오류'
      );
      return;
    }

    setMessage(
      approvalStatus==='승인'
        ? '작업보고가 승인되었습니다.'
        : approvalStatus==='반려'
          ? '작업보고가 반려되었습니다.'
          : '검토대기 상태로 변경되었습니다.'
    );

    await load();
  }catch(error){
    console.error(
      'admin report review client error',
      error
    );

    setMessage(
      '작업보고 검토 요청을 처리하지 못했습니다.'
    );
  }finally{
    setReviewing(false);
  }
}
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
          <div className="admin-report-ing">
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
            <section className="admin-report-review">
  <div className="admin-report-review-head">
    <div>
      <h3>관리자 검토</h3>
      <p>
        기사 작업보고를 확인한 뒤 승인 또는 반려합니다.
      </p>
    </div>

    <strong
      className={
        'review-status '+
        (
          report.report_approval_status||
          '검토대기'
        )
      }
    >
      {report.report_approval_status||
        '검토대기'}
    </strong>
  </div>

  {report.report_approval_status==='반려'&&
    report.report_rejection_reason&&(
      <div className="admin-report-rejection-view">
        <b>기존 반려 사유</b>
        <p>{report.report_rejection_reason}</p>
      </div>
    )}

  <label className="admin-report-rejection-input">
    <span>반려 사유</span>

    <textarea
      value={rejectionReason}
      onChange={event=>
        setRejectionReason(
          event.target.value
        )
      }
      placeholder="기사에게 보완을 요청할 내용을 입력하세요."
    />
  </label>

  <div className="admin-report-review-actions">
    {report.report_approval_status!=='검토대기'&&(
      <button
        type="button"
        disabled={reviewing}
        onClick={()=>
          void reviewReport('검토대기')
        }
      >
        검토대기로 변경
      </button>
    )}

    <button
      type="button"
      className="reject"
      disabled={reviewing}
      onClick={()=>
        void reviewReport('반려')
      }
    >
      반려
    </button>

    <button
      type="button"
      className="approve"
      disabled={reviewing}
      onClick={()=>
        void reviewReport('승인')
      }
    >
      {reviewing?'처리 중':'승인'}
    </button>
  </div>

  {report.report_reviewed_at&&(
    <small className="admin-report-reviewed-at">
      검토일시:
      {' '}
      {formatDateTime(
        report.report_reviewed_at
      )}
      {' · '}
      {report.report_reviewed_by||'관리자'}
    </small>
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
