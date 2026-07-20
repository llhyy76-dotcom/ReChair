import {NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function GET(){
  try{
    const {data,error}=await getSupabaseServer()
      .from('admin_audit_logs')
      .select('id,action,result,ip_address,user_agent,created_at')
      .order('created_at',{ascending:false})
      .limit(200);
    if(error)throw error;
    return NextResponse.json({data:data||[]});
  }catch(e:any){
    return NextResponse.json({error:e?.message||'보안기록 조회 오류'},{status:500});
  }
}
