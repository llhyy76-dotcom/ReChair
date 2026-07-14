import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function GET(req:NextRequest){
  try{
    const s=getSupabaseServer(); const u=new URL(req.url);
    const status=u.searchParams.get('status'),service=u.searchParams.get('service'),q=u.searchParams.get('q');
    let query=s.from('consultations').select('*').order('created_at',{ascending:false}).limit(300);
    if(status)query=query.eq('status',status);
    if(service)query=query.eq('service_type',service);
    if(q){const x=q.replace(/[%_,]/g,' ');query=query.or(`customer_name.ilike.%${x}%,phone.ilike.%${x}%,region.ilike.%${x}%,model_name.ilike.%${x}%,product_title.ilike.%${x}%`)}
    const {data,error}=await query;if(error)throw error;
    return NextResponse.json({data:(data||[]).map((i:any)=>({...i,customer_name:i.customer_name??i.name??'이름 없음',service_type:i.service_type??i.service??'미분류',model_name:i.model_name??i.model??null,assignee:i.assignee??i.manager??null,estimate_amount:Number(i.estimate_amount??i.quote??0),status:i.status??'신규'}))});
  }catch(e:any){return NextResponse.json({error:e?.message||'상담 조회 오류'},{status:500})}
}
