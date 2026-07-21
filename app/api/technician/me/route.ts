import {NextResponse} from 'next/server';
import {getTechnicianSession} from '@/lib/technicianAuth';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const session=await getTechnicianSession();

    if(!session){
      return NextResponse.json(
        {error:'기사 로그인이 필요합니다.'},
        {status:401}
      );
    }

    return NextResponse.json({
      data:{
        id:session.technician_id,
        name:session.technician.name,
        phone:session.technician.phone,
        region:session.technician.region,
        team_name:session.technician.team_name,
        is_active:session.technician.is_active,
      },
    });
  }catch(e:any){
    return NextResponse.json(
      {error:e?.message||'기사 세션 조회 오류'},
      {status:500}
    );
  }
}
