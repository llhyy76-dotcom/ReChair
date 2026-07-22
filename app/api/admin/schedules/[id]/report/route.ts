import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdminSession} from '@/lib/adminAuth';

export const dynamic='force-dynamic';

export async function GET(
  _req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdminSession();

    const {id}=await params;
    const supabase=getSupabaseServer();

    const {data:schedule,error:scheduleError}=await supabase
      .from('service_schedules')
      .select(`
        id,
        consultation_id,
        customer_name,
        phone,
        address,
        region,
        service_type,
        assignee,
        scheduled_at,
        duration_minutes,
        status,
        memo,
        symptom_text,
        action_text,
        replaced_parts,
        customer_confirmation,
        customer_signature_url,
        departed_at,
        arrival_at,
        work_started_at,
        completed_at,
        field_report_updated_at
      `)
      .eq('id',id)
      .single();

    if(scheduleError||!schedule){
      return NextResponse.json(
        {
          error:'작업보고를 찾을 수 없습니다.',
        },
        {
          status:404,
        }
      );
    }

    const {data:photos,error:photoError}=await supabase
      .from('service_schedule_photos')
      .select(`
        id,
        schedule_id,
        photo_type,
        photo_url,
        created_at
      `)
      .eq('schedule_id',id)
      .order('created_at',{
        ascending:true,
      });

    if(photoError){
      throw photoError;
    }

    return NextResponse.json({
      success:true,
      data:{
        ...schedule,
        service_schedule_photos:photos||[],
      },
    });
  }catch(error:any){
    if(
      error?.message==='ADMIN_UNAUTHORIZED'||
      error?.message==='UNAUTHORIZED'
    ){
      return NextResponse.json(
        {
          error:'관리자 로그인이 필요합니다.',
        },
        {
          status:401,
        }
      );
    }

    console.error('admin field report load error',error);

    return NextResponse.json(
      {
        error:error?.message||
          '관리자 작업보고 조회 오류',
      },
      {
        status:500,
      }
    );
  }
}
