import {NextRequest,NextResponse} from 'next/server';
import {requireTechnicianSession} from '@/lib/technicianAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';

export async function GET(
  _req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const supabase=getSupabaseServer();

    const {data:schedule,error:scheduleError}=await supabase
      .from('service_schedules')
      .select('*')
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .single();

    if(scheduleError||!schedule){
      return NextResponse.json(
        {error:'본인에게 배정된 일정을 찾을 수 없습니다.'},
        {status:404}
      );
    }

    const {data:photos,error:photoError}=await supabase
      .from('service_schedule_photos')
      .select(`
        id,
        schedule_id,
        technician_id,
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
      data:{
        ...schedule,
        service_schedule_photos:photos||[],
      },
    });
  }catch(e:any){
    if(e?.message==='TECHNICIAN_UNAUTHORIZED'){
      return NextResponse.json(
        {error:'기사 로그인이 필요합니다.'},
        {status:401}
      );
    }

    console.error('field report load error',e);

    return NextResponse.json(
      {error:e?.message||'작업보고 조회 오류'},
      {status:500}
    );
  }
}

export async function PATCH(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const body=await req.json();
    const supabase=getSupabaseServer();

    const payload={
      symptom_text:String(body.symptom_text||'').trim()||null,
      action_text:String(body.action_text||'').trim()||null,
      replaced_parts:String(body.replaced_parts||'').trim()||null,
      customer_confirmation:
        String(body.customer_confirmation||'').trim()||null,
      completed_by_technician_id:session.technician_id,
      field_report_updated_at:new Date().toISOString(),
    };

    const {data,error}=await supabase
      .from('service_schedules')
      .update(payload)
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .select('*')
      .single();

    if(error){
      throw error;
    }

    return NextResponse.json({
      success:true,
      data,
    });
  }catch(e:any){
    if(e?.message==='TECHNICIAN_UNAUTHORIZED'){
      return NextResponse.json(
        {error:'기사 로그인이 필요합니다.'},
        {status:401}
      );
    }

    console.error('field report save error',e);

    return NextResponse.json(
      {error:e?.message||'작업보고 저장 오류'},
      {status:500}
    );
  }
}

export async function POST(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const form=await req.formData();

    const photoType=String(
      form.get('photo_type')||'other'
    );

    const file=form.get('file');

    if(!(file instanceof File)){
      return NextResponse.json(
        {error:'사진 파일이 필요합니다.'},
        {status:400}
      );
    }

    const allowed=[
      'front',
      'side',
      'label',
      'after',
      'part',
      'receipt',
      'other',
    ];

    if(!allowed.includes(photoType)){
      return NextResponse.json(
        {error:'허용되지 않은 사진 구분입니다.'},
        {status:400}
      );
    }

    if(file.size>10*1024*1024){
      return NextResponse.json(
        {error:'사진은 10MB 이하만 등록할 수 있습니다.'},
        {status:400}
      );
    }

    const supabase=getSupabaseServer();

    const {data:schedule,error:scheduleError}=await supabase
      .from('service_schedules')
      .select('id,assignee')
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .single();

    if(scheduleError||!schedule){
      return NextResponse.json(
        {error:'본인 일정만 사진을 등록할 수 있습니다.'},
        {status:403}
      );
    }

    const rawExtension=
      file.name.split('.').pop()||
      file.type.split('/').pop()||
      'jpg';

    const extension=rawExtension.replace(
      /[^a-zA-Z0-9]/g,
      ''
    )||'jpg';

    const objectPath=[
      session.technician_id,
      id,
      `${photoType}-${Date.now()}.${extension}`,
    ].join('/');

    const arrayBuffer=await file.arrayBuffer();
    const bytes=new Uint8Array(arrayBuffer);

    const {error:uploadError}=await supabase.storage
      .from('service-report-photos')
      .upload(
        objectPath,
        bytes,
        {
          contentType:file.type||'image/jpeg',
          cacheControl:'3600',
          upsert:false,
        }
      );

    if(uploadError){
      console.error('photo storage upload error',uploadError);
      throw uploadError;
    }

    const {data:publicUrlData}=supabase.storage
      .from('service-report-photos')
      .getPublicUrl(objectPath);

    const photoUrl=publicUrlData.publicUrl;

    if(!photoUrl){
      throw new Error('사진 공개 URL을 생성하지 못했습니다.');
    }

    const {data:photo,error:photoError}=await supabase
      .from('service_schedule_photos')
      .insert({
        schedule_id:id,
        technician_id:session.technician_id,
        photo_type:photoType,
        photo_url:photoUrl,
      })
      .select('*')
      .single();

    if(photoError){
      console.error('photo database insert error',photoError);

      // DB 등록 실패 시 Storage에 남은 파일 제거
      await supabase.storage
        .from('service-report-photos')
        .remove([objectPath]);

      throw photoError;
    }

    return NextResponse.json({
      success:true,
      data:photo,
    });
  }catch(e:any){
    if(e?.message==='TECHNICIAN_UNAUTHORIZED'){
      return NextResponse.json(
        {error:'기사 로그인이 필요합니다.'},
        {status:401}
      );
    }

    console.error('field report photo upload error',e);

    return NextResponse.json(
      {error:e?.message||'사진 업로드 오류'},
      {status:500}
    );
  }
}
export async function DELETE(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;

    const photoId=new URL(req.url)
      .searchParams
      .get('photo_id');

    if(!photoId){
      return NextResponse.json(
        {error:'삭제할 사진 정보가 필요합니다.'},
        {status:400}
      );
    }

    const supabase=getSupabaseServer();

    const {data:schedule,error:scheduleError}=await supabase
      .from('service_schedules')
      .select('id,assignee')
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .single();

    if(scheduleError||!schedule){
      return NextResponse.json(
        {error:'본인 일정의 사진만 삭제할 수 있습니다.'},
        {status:403}
      );
    }

    const {data:photo,error:photoLoadError}=await supabase
      .from('service_schedule_photos')
      .select('id,photo_url')
      .eq('id',photoId)
      .eq('schedule_id',id)
      .single();

    if(photoLoadError||!photo){
      return NextResponse.json(
        {error:'사진 정보를 찾을 수 없습니다.'},
        {status:404}
      );
    }

    const marker='/service-report-photos/';
    const markerIndex=photo.photo_url.indexOf(marker);

    if(markerIndex>=0){
      const storagePath=decodeURIComponent(
        photo.photo_url.slice(
          markerIndex+marker.length
        )
      );

      await supabase.storage
        .from('service-report-photos')
        .remove([storagePath]);
    }

    const {error:deleteError}=await supabase
      .from('service_schedule_photos')
      .delete()
      .eq('id',photoId)
      .eq('schedule_id',id);

    if(deleteError){
      throw deleteError;
    }

    return NextResponse.json({
      success:true,
    });
  }catch(e:any){
    if(e?.message==='TECHNICIAN_UNAUTHORIZED'){
      return NextResponse.json(
        {error:'기사 로그인이 필요합니다.'},
        {status:401}
      );
    }

    return NextResponse.json(
      {error:e?.message||'사진 삭제 오류'},
      {status:500}
    );
  }
}
