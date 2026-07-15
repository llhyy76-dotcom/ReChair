import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function PATCH(req:NextRequest){
  try{
    const body=await req.json();
    const items=Array.isArray(body.items)?body.items:[];

    if(!items.length){
      return NextResponse.json({error:'저장할 동선이 없습니다.'},{status:400});
    }

    const supabase=getSupabaseServer();

    for(const item of items){
      const {error}=await supabase
        .from('service_schedules')
        .update({
          route_order:Number(item.route_order||0),
          updated_at:new Date().toISOString(),
        })
        .eq('id',item.id);

      if(error)throw error;
    }

    return NextResponse.json({success:true});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'동선 저장 오류'},{status:500});
  }
}
