import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    await requireAdmin();
    const supabase=getSupabaseServer();
    const [{data:technicians,error:technicianError},{data:locations,error:locationError}]=await Promise.all([
      supabase.from('technicians').select('id,name,team_name,region,phone,is_active').eq('is_active',true).order('name'),
      supabase.from('technician_live_locations').select('*').eq('sharing_enabled',true).order('updated_at',{ascending:false}),
    ]);
    if(technicianError)throw technicianError;
    if(locationError)throw locationError;
    const locationMap=new Map((locations||[]).map(row=>[row.technician_id,row]));
    return NextResponse.json({
      data:(technicians||[]).map(technician=>({
        ...technician,
        location:locationMap.get(technician.id)||null,
      }))
    });
  }catch(error:any){
    const status=error?.message==='ADMIN_UNAUTHORIZED'?401:500;
    return NextResponse.json({error:status===401?'관리자 로그인이 필요합니다.':error?.message||'기사 위치 조회 오류'},{status});
  }
}
