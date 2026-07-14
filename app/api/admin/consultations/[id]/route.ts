import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
const STATUS=['신규','상담중','견적발송','예약완료','방문완료','판매완료','종료'];

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params; const b=await req.json();
    if(!STATUS.includes(b.status))return NextResponse.json({error:'허용되지 않은 상태입니다.'},{status:400});
    const payload={status:b.status,assignee:b.assignee||null,memo:b.memo||null,estimate_amount:Number(b.estimate_amount||0),next_action_at:b.next_action_at||null,updated_at:new Date().toISOString()};
    const {data,error}=await getSupabaseServer().from('consultations').update(payload).eq('id',id).select('*').single();
    if(error)throw error; return NextResponse.json({data});
  }catch(e:any){return NextResponse.json({error:e?.message||'상담 저장 오류'},{status:500})}
}
