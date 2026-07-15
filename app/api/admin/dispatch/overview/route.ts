import {NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
export async function GET(){
  try{
    const sb=getSupabaseServer(),now=new Date();
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString();
    const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).toISOString();
    const [a,b,c]=await Promise.all([
      sb.from('technicians').select('*').order('is_active',{ascending:false}).order('name'),
      sb.from('service_schedules').select('assignee,status').gte('scheduled_at',start).lt('scheduled_at',end),
      sb.from('consultations').select('id,customer_name,phone,region,address,service_type,created_at,status,next_action_at').in('status',['신규','상담중']).is('next_action_at',null).order('created_at',{ascending:true}).limit(100)
    ]);
    if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;
    const technicians=(a.data||[]).map((t:any)=>{const count=(b.data||[]).filter((s:any)=>s.assignee===t.name&&s.status!=='취소').length,cap=Number(t.daily_capacity||5);return {...t,today_count:count,remaining_capacity:Math.max(0,cap-count)}});
    return NextResponse.json({data:{technicians,waiting_consultations:c.data||[]}});
  }catch(e:any){return NextResponse.json({error:e?.message||'배정 현황 조회 오류'},{status:500})}
}
