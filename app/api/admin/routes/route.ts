import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function GET(req:NextRequest){
  try{
    const u=new URL(req.url);
    const date=u.searchParams.get('date');
    const assignee=u.searchParams.get('assignee');

    if(!date||!assignee){
      return NextResponse.json({error:'날짜와 기사 정보가 필요합니다.'},{status:400});
    }

    const start=new Date(date+'T00:00:00');
    const end=new Date(date+'T23:59:59.999');

    const {data,error}=await getSupabaseServer()
      .from('service_schedules')
      .select('*')
      .eq('assignee',assignee)
      .gte('scheduled_at',start.toISOString())
      .lte('scheduled_at',end.toISOString())
      .neq('status','취소')
      .order('route_order',{ascending:true})
      .order('scheduled_at',{ascending:true});

    if(error)throw error;

    return NextResponse.json({
      data:(data||[]).map((row:any,index:number)=>({
        ...row,
        route_order:Number(row.route_order||index+1),
      }))
    });
  }catch(e:any){
    return NextResponse.json({error:e?.message||'동선 조회 오류'},{status:500});
  }
}
