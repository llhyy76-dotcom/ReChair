export type ScheduleKind='service'|'rental_installation'|'rental_retrieval'|string;

type ScheduleLike={
  schedule_kind?:string|null;
  service_type?:string|null;
};

const INSTALLATION_SERVICE_TYPES=new Set([
  '개인용 안마의자 렌탈',
  '영업용(코인형) 안마의자 렌탈',
  '영업용 안마의자 렌탈',
  '코인형 안마의자 렌탈',
  '안마의자 렌탈 설치',
]);

export function normalizeScheduleKind(schedule:ScheduleLike):ScheduleKind{
  const current=String(schedule.schedule_kind||'').trim();
  if(current==='rental_installation'||current==='rental_retrieval'){
    return current;
  }

  const serviceType=String(schedule.service_type||'').trim();
  if(/렌탈\s*회수|회수.*렌탈/.test(serviceType)){
    return 'rental_retrieval';
  }
  if(
    INSTALLATION_SERVICE_TYPES.has(serviceType)||
    /렌탈\s*설치/.test(serviceType)
  ){
    return 'rental_installation';
  }

  return current||'service';
}

export function isRentalInstallation(schedule:ScheduleLike){
  return normalizeScheduleKind(schedule)==='rental_installation';
}

export function isRentalRetrieval(schedule:ScheduleLike){
  return normalizeScheduleKind(schedule)==='rental_retrieval';
}

export function isCommercialRental(serviceType?:string|null){
  return /영업용|코인/.test(String(serviceType||''));
}
