import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  try{
    await requireAdmin();
    const url=new URL(req.url);
    const start=url.searchParams.get('start');
    const end=url.searchParams.get('end');
    const date=url.searchParams.get('date');
    const view=url.searchParams.get('view')||'day';

    let query=getSupabaseServer()
      .from('service_schedules')
      .select('*')
      .order('scheduled_at',{ascending:true});

    if(start&&end){
      const startDate=new Date(start);
      const endDate=new Date(end);
      if(Number.isNaN(startDate.getTime())||Number.isNaN(endDate.getTime())||endDate<=startDate){
        return NextResponse.json({error:'조회 기간이 올바르지 않습니다.'},{status:400});
      }
      query=query.gte('scheduled_at',startDate.toISOString()).lt('scheduled_at',endDate.toISOString());
    }else if(date){
      const startDate=new Date(`${date}T00:00:00`);
      const endDate=new Date(startDate);
      if(view==='month')endDate.setMonth(endDate.getMonth()+1);
      else if(view==='week')endDate.setDate(endDate.getDate()+7);
      else endDate.setDate(endDate.getDate()+1);
      query=query.gte('scheduled_at',startDate.toISOString()).lt('scheduled_at',endDate.toISOString());
    }

    const {data,error}=await query;
    if(error)throw error;
    return NextResponse.json({data:data||[]});
  }catch(error:any){
    if(error?.message==='ADMIN_UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    return NextResponse.json({error:error?.message||'일정 조회 오류'},{status:500});
  }
}
