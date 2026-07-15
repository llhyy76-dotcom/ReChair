import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function GET(req:NextRequest){
  try{
    const u=new URL(req.url);const date=u.searchParams.get('date');
    let q=getSupabaseServer().from('service_schedules').select('*').order('scheduled_at',{ascending:true});
    if(date){
      q=q.gte('scheduled_at',new Date(date+'T00:00:00').toISOString())
         .lte('scheduled_at',new Date(date+'T23:59:59.999').toISOString());
    }
    const {data,error}=await q;if(error)throw error;
    return NextResponse.json({data:data||[]});
  }catch(e:any){return NextResponse.json({error:e?.message||'일정 조회 오류'},{status:500})}
}
