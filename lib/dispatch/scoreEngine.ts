export type DispatchScoreBreakdown={
  region:number;
  workload:number;
  schedule_fit:number;
  availability:number;
  capacity:number;
  total:number;
};

function clamp(value:number,min=0,max=100){
  return Math.max(min,Math.min(max,value));
}

export function buildDispatchScore({
  regionMatchScore,
  todayCount,
  dailyCapacity,
  nearestGapMinutes,
  hasConflict,
  isAvailable,
  isOverCapacity,
}:{
  regionMatchScore:number;
  todayCount:number;
  dailyCapacity:number;
  nearestGapMinutes:number|null;
  hasConflict:boolean;
  isAvailable:boolean;
  isOverCapacity:boolean;
}):DispatchScoreBreakdown{
  const capacity=Math.max(1,dailyCapacity);
  const loadRatio=clamp(todayCount/capacity,0,1);

  const region=Math.round(clamp(regionMatchScore)*0.35);
  const workload=Math.round((1-loadRatio)*20);

  let scheduleFit=20;
  if(hasConflict)scheduleFit=0;
  else if(nearestGapMinutes!==null){
    if(nearestGapMinutes<30)scheduleFit=6;
    else if(nearestGapMinutes<60)scheduleFit=12;
    else if(nearestGapMinutes<=180)scheduleFit=20;
    else scheduleFit=16;
  }

  const availability=isAvailable?15:0;
  const capacityScore=isOverCapacity?0:Math.round((1-loadRatio)*10);
  const total=region+workload+scheduleFit+availability+capacityScore;

  return {
    region,
    workload,
    schedule_fit:scheduleFit,
    availability,
    capacity:capacityScore,
    total:clamp(total),
  };
}

export function dispatchConfidence(
  firstScore:number,
  secondScore?:number|null,
){
  const gap=firstScore-Number(secondScore||0);
  if(firstScore<45)return {level:'검토필요',reason:'추천 점수가 낮습니다.'};
  if(gap<5)return {level:'검토필요',reason:'상위 후보 점수 차이가 작습니다.'};
  if(firstScore>=80&&gap>=10)return {level:'높음',reason:'추천 점수와 후보 간 차이가 충분합니다.'};
  return {level:'보통',reason:'관리자 확인 후 적용을 권장합니다.'};
}
