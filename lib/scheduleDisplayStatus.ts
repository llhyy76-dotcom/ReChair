export type ScheduleLike={
  status?:string|null;
  field_report_updated_at?:string|null;
  completed_at?:string|null;
  report_approval_status?:string|null;
  report_rejection_reason?:string|null;
};

export type DisplayStatus=
  |'배정대기'
  |'방문예정'
  |'이동중'
  |'현장도착'
  |'작업중'
  |'검토대기'
  |'승인완료'
  |'반려'
  |'재방문요청'
  |'취소';

const REVISIT_WORDS=[
  '재방문',
  '방문 필요',
  '현장 확인',
  '현장 재확인',
];

export function isRevisitRequested(item:ScheduleLike){
  const reason=String(
    item.report_rejection_reason||''
  ).trim();

  return REVISIT_WORDS.some(word=>
    reason.includes(word)
  );
}

export function hasSubmittedReport(item:ScheduleLike){
  return Boolean(
    item.field_report_updated_at||
    item.completed_at||
    item.report_approval_status
  );
}

export function getDisplayStatus(
  item:ScheduleLike
):DisplayStatus{
  if(item.status==='취소'){
    return '취소';
  }

  if(item.report_approval_status==='승인'){
    return '승인완료';
  }

  if(item.report_approval_status==='반려'){
    return isRevisitRequested(item)
      ? '재방문요청'
      : '반려';
  }

  if(
    item.report_approval_status==='검토대기'||
    hasSubmittedReport(item)
  ){
    return '검토대기';
  }

  if(item.status==='배정대기'){
    return '배정대기';
  }

  if(item.status==='배정완료'){
    return '방문예정';
  }

  if(item.status==='방문중'){
    return '현장도착';
  }

  if(item.status==='이동중'){
    return '이동중';
  }

  if(item.status==='작업중'){
    return '작업중';
  }

  return '방문예정';
}

export function getDisplayStatusClass(
  item:ScheduleLike
){
  const status=getDisplayStatus(item);

  return {
    '배정대기':'waiting',
    '방문예정':'scheduled',
    '이동중':'moving',
    '현장도착':'arrived',
    '작업중':'working',
    '검토대기':'review-pending',
    '승인완료':'approved',
    '반려':'rejected',
    '재방문요청':'revisit',
    '취소':'cancelled',
  }[status];
}

export function isFinalApproved(
  item:ScheduleLike
){
  return getDisplayStatus(item)==='승인완료';
}

export function isReportPending(
  item:ScheduleLike
){
  return getDisplayStatus(item)==='검토대기';
}

export function isReportRejected(
  item:ScheduleLike
){
  const status=getDisplayStatus(item);

  return (
    status==='반려'||
    status==='재방문요청'
  );
}

export function isVisitActionable(
  item:ScheduleLike
){
  const display=getDisplayStatus(item);

  return [
    '배정대기',
    '방문예정',
    '이동중',
    '현장도착',
    '작업중',
    '반려',
    '재방문요청',
  ].includes(display);
}
