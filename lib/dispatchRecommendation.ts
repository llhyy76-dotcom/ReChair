export type TechnicianRow={
  id:string;
  name:string;
  region?:string|null;
  team_name?:string|null;
  daily_capacity?:number|null;
  is_active?:boolean|null;
  memo?:string|null;
};

export type ScheduleRow={
  id?:string;
  assignee?:string|null;
  scheduled_at:string;
  duration_minutes?:number|null;
  status?:string|null;
  address?:string|null;
  region?:string|null;
};

const KST_OFFSET_MS=9*60*60*1000;

const REGION_ALIASES:Record<string,string[]>={
  '서울':['서울','서울시','서울특별시'],
  '고양':['고양','고양시','덕양','일산동','일산서'],
  '파주':['파주','파주시'],
  '김포':['김포','김포시'],
  '경기 북부':['고양','파주','김포','의정부','양주','포천','동두천','연천','구리','남양주'],
  '경기 남부':['수원','용인','화성','오산','평택','안성','성남','광주','하남','이천','여주','의왕','군포','안양'],
};

function expandRegionTokens(values:unknown[]){
  const result=new Set<string>();
  for(const value of values){
    for(const token of tokens(value))result.add(token);
    const text=normalize(value);
    for(const [group,aliases] of Object.entries(REGION_ALIASES)){
      if(aliases.some(alias=>text.includes(normalize(alias)))){
        result.add(normalize(group));
        aliases.forEach(alias=>result.add(normalize(alias)));
      }
    }
  }
  return [...result];
}

export function kstDayRange(dateText:string){
  const normalized=/^\d{4}-\d{2}-\d{2}$/.test(dateText)
    ?dateText
    :new Date().toISOString().slice(0,10);
  const start=new Date(`${normalized}T00:00:00+09:00`);
  const end=new Date(start.getTime()+24*60*60*1000);
  return {start:start.toISOString(),end:end.toISOString()};
}

function normalize(value:unknown){
  return String(value||'')
    .toLowerCase()
    .replace(/[()\[\]{},.·\-_/\\]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function tokens(value:unknown){
  return normalize(value)
    .split(' ')
    .filter(token=>token.length>=2);
}

export function regionMatchScore(
  technician:TechnicianRow,
  region?:string|null,
  address?:string|null,
){
  const targetTokens=expandRegionTokens([region,address]);
  const techText=expandRegionTokens([
    technician.region,
    technician.team_name,
    technician.memo,
  ]).join(' ');

  if(targetTokens.length===0)return 0;

  const matched=targetTokens.filter(token=>techText.includes(token));
  if(matched.length===0)return 0;

  return Math.min(100,40+matched.length*20);
}

export function overlaps(
  schedule:ScheduleRow,
  requestedStart:Date,
  requestedDuration:number,
){
  if(schedule.status==='취소')return false;
  const existingStart=new Date(schedule.scheduled_at);
  if(Number.isNaN(existingStart.getTime()))return false;
  const existingDuration=Math.max(15,Number(schedule.duration_minutes||60));
  const existingEnd=new Date(existingStart.getTime()+existingDuration*60*1000);
  const requestedEnd=new Date(requestedStart.getTime()+requestedDuration*60*1000);
  return requestedStart<existingEnd&&requestedEnd>existingStart;
}

export function minutesGap(
  schedule:ScheduleRow,
  requestedStart:Date,
  requestedDuration:number,
){
  const existingStart=new Date(schedule.scheduled_at);
  const existingDuration=Math.max(15,Number(schedule.duration_minutes||60));
  const existingEnd=new Date(existingStart.getTime()+existingDuration*60*1000);
  const requestedEnd=new Date(requestedStart.getTime()+requestedDuration*60*1000);
  if(requestedStart>=existingEnd){
    return Math.round((requestedStart.getTime()-existingEnd.getTime())/60000);
  }
  if(existingStart>=requestedEnd){
    return Math.round((existingStart.getTime()-requestedEnd.getTime())/60000);
  }
  return 0;
}

export function scoreTechnician({
  technician,
  schedules,
  requestedStart,
  requestedDuration,
  region,
  address,
}:{
  technician:TechnicianRow;
  schedules:ScheduleRow[];
  requestedStart:Date;
  requestedDuration:number;
  region?:string|null;
  address?:string|null;
}){
  const own=schedules.filter(row=>
    row.assignee===technician.name&&row.status!=='취소'
  );
  const capacity=Math.max(1,Number(technician.daily_capacity||5));
  const todayCount=own.length;
  const remainingCapacity=Math.max(0,capacity-todayCount);
  const conflict=own.some(row=>overlaps(row,requestedStart,requestedDuration));
  const gaps=own.map(row=>minutesGap(row,requestedStart,requestedDuration));
  const nearestGap=gaps.length?Math.min(...gaps):null;
  const matchScore=regionMatchScore(technician,region,address);
  const overloaded=todayCount>=capacity;

  let score=0;
  score+=matchScore;
  score+=remainingCapacity*12;
  score-=todayCount*5;
  if(nearestGap!==null){
    if(nearestGap>=60&&nearestGap<=180)score+=12;
    else if(nearestGap>180)score+=5;
  }else{
    score+=10;
  }
  if(overloaded)score-=80;
  if(conflict)score-=1000;

  const reasons:string[]=[];
  if(matchScore>0)reasons.push('담당지역 일치');
  else reasons.push('담당지역 직접 일치 없음');
  reasons.push(`당일 ${todayCount}/${capacity}건`);
  reasons.push(conflict?'시간 충돌 있음':'시간 충돌 없음');
  if(nearestGap!==null&&!conflict)reasons.push(`인접 일정과 최소 ${nearestGap}분 간격`);

  return {
    ...technician,
    today_count:todayCount,
    daily_capacity:capacity,
    remaining_capacity:remainingCapacity,
    region_match:matchScore>0,
    region_match_score:matchScore,
    has_conflict:conflict,
    is_over_capacity:overloaded,
    nearest_gap_minutes:nearestGap,
    score,
    reasons,
    eligible:!conflict&&!overloaded,
  };
}
