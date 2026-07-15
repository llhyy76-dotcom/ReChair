import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
function match(t:any,text:string){const h=[t.region,...(Array.isArray(t.service_regions)?t.service_regions:[])].filter(Boolean).join(' ').toLowerCase();return text.replace(/[,\-·]/g,' ').split(/\s+/).filter(v=>v.length>=2).some(w=>h.includes(w.toLowerCase()))}
export async function GET(req:NextRequest){
  try{
    const u=new URL(req.url),text=((u.searchParams.get('region')||'')+' '+(u.searchParams.get('address')||'')).trim(),sb=getSupabaseServer(),now=new Date();
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString(),end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).toISOString();
    const [a,b]=await Promise.all([sb.from('technicians').select('*').eq('is_active',true),sb.from('service_schedules').select('assignee,status').gte('scheduled_at',start).lt('scheduled_at',end)]);
    if(a.error)throw a.error;if(b.error)throw b.error;
    const scored=(a.data||[]).map((t:any)=>{const count=(b.data||[]).filter((s:any)=>s.assignee===t.name&&s.status!=='취소').length,cap=Number(t.daily_capacity||5),remain=Math.max(0,cap-count),m=text?match(t,text):false;return {...t,today_count:count,remaining_capacity:remain,region_match:m,score:(m?100:0)+remain*10-count*3}}).sort((x:any,y:any)=>y.score-x.score);
    const best=scored[0]||null;
    return NextResponse.json({data:{technician:best,reason:best?`${best.region_match?'담당지역이 일치하며, ':''}오늘 ${best.today_count}건 배정되어 잔여 처리한도 ${best.remaining_capacity}건입니다.`:'활성 기사·팀이 없습니다.',candidates:scored.slice(0,5)}});
  }catch(e:any){return NextResponse.json({error:e?.message||'추천 기사 조회 오류'},{status:500})}
}
