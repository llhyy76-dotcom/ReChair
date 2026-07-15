import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
const STATES=['배정대기','배정완료','이동중','방문중','완료','취소'];

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const b=await req.json();
    if(!STATES.includes(b.status))return NextResponse.json({error:'허용되지 않은 상태입니다.'},{status:400});
    const payload={scheduled_at:b.scheduled_at,assignee:b.assignee||null,duration_minutes:Number(b.duration_minutes||60),status:b.status,address:b.address||null,memo:b.memo||null,updated_at:new Date().toISOString()};
    const {data,error}=await getSupabaseServer().from('service_schedules').update(payload).eq('id',id).select('*').single();
    if(error)throw error;return NextResponse.json({data});
  }catch(e:any){return NextResponse.json({error:e?.message||'일정 저장 오류'},{status:500})}
}
