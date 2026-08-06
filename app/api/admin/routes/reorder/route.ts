import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';

export async function PATCH(req:NextRequest){
  try{
    await requireAdmin();

    const body=await req.json();
    const items=Array.isArray(body.items)?body.items:[];

    if(!items.length){
      return NextResponse.json({error:'저장할 동선이 없습니다.'},{status:400});
    }

    const supabase=getSupabaseServer();

    for(const item of items){
      const payload:any={
        route_order:Number(item.route_order||0),
        updated_at:new Date().toISOString(),
      };

      if(item.scheduled_at){
        const value=new Date(item.scheduled_at);
        if(Number.isNaN(value.getTime())){
          return NextResponse.json({error:'올바르지 않은 방문시간이 포함되어 있습니다.'},{status:400});
        }
        payload.scheduled_at=value.toISOString();
      }

      const {error}=await supabase
        .from('service_schedules')
        .update(payload)
        .eq('id',item.id);

      if(error)throw error;
    }

    return NextResponse.json({success:true});
  }catch(e:any){
    if(e?.message==='ADMIN_UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    return NextResponse.json({error:e?.message||'동선 저장 오류'},{status:500});
  }
}
