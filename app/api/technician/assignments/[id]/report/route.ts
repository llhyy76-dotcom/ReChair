import {NextRequest,NextResponse} from 'next/server';
import {requireTechnicianSession} from '@/lib/technicianAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';

const PHOTO_BUCKET='service-report-photos';

const ALLOWED_PHOTO_TYPES=[
  'front',
  'side',
  'label',
  'after',
  'part',
  'receipt',
  'other',
];

function unauthorizedResponse(){
  return NextResponse.json(
    {
      error:'기사 로그인이 필요합니다.',
    },
    {
      status:401,
    }
  );
}

/**
 * 작업보고와 등록 사진 조회
 */
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
        {
          error:'본인에게 배정된 일정을 찾을 수 없습니다.',
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
      success:true,
      data:{
        ...schedule,
        service_schedule_photos:photos||[],
      },
    });
  }catch(error:any){
    if(error?.message==='TECHNICIAN_UNAUTHORIZED'){
      return unauthorizedResponse();
    }

    console.error('field report load error',error);

    return NextResponse.json(
      {
        error:error?.message||'작업보고 조회 오류',
      },
      {
        status:500,
      }
    );
  }
}

/**
 * 증상·조치내용·교체부품·고객 확인사항 저장
 */
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
  customer_confirmation:String(body.customer_confirmation||'').trim()||null,

  completed_by_technician_id:session.technician_id,
  field_report_updated_at:new Date().toISOString(),

  // 반려 후 기사가 내용을 수정하면 관리자에게 재검토 요청
  report_approval_status:'검토대기',
  report_rejection_reason:null,
  report_reviewed_at:null,
  report_reviewed_by:null,
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
  }catch(error:any){
    if(error?.message==='TECHNICIAN_UNAUTHORIZED'){
      return unauthorizedResponse();
    }

    console.error('field report save error',error);

    return NextResponse.json(
      {
        error:error?.message||'작업보고 저장 오류',
      },
      {
        status:500,
      }
    );
  }
}

/**
 * 사진 업로드
 */
export async function POST(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  let uploadedObjectPath:string|null=null;

  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const supabase=getSupabaseServer();

    const form=await req.formData();

    const photoType=String(
      form.get('photo_type')||'other'
    );

    const file=form.get('file');

    if(!(file instanceof File)){
      return NextResponse.json(
        {
          error:'사진 파일이 필요합니다.',
        },
        {
          status:400,
        }
      );
    }

    if(!ALLOWED_PHOTO_TYPES.includes(photoType)){
      return NextResponse.json(
        {
          error:'허용되지 않은 사진 구분입니다.',
        },
        {
          status:400,
        }
      );
    }

    /*
     * Vercel 요청 본문 제한을 고려해
     * 클라이언트에서 압축된 3.5MB 이하 파일만 받습니다.
     */
    if(file.size>3.5*1024*1024){
      return NextResponse.json(
        {
          error:
            '사진 용량이 너무 큽니다. 3.5MB 이하로 축소한 뒤 다시 등록하세요.',
        },
        {
          status:400,
        }
      );
    }

    if(!file.type.startsWith('image/')){
      return NextResponse.json(
        {
          error:'이미지 파일만 등록할 수 있습니다.',
        },
        {
          status:400,
        }
      );
    }

    // 로그인한 기사에게 실제 배정된 일정인지 확인
    const {data:schedule,error:scheduleError}=await supabase
      .from('service_schedules')
      .select('id,assignee')
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .single();

    if(scheduleError||!schedule){
      return NextResponse.json(
        {
          error:'본인 일정에만 사진을 등록할 수 있습니다.',
        },
        {
          status:403,
        }
      );
    }

    const originalExtension=
      file.name.split('.').pop()||
      file.type.split('/').pop()||
      'jpg';

    const extension=
      originalExtension.replace(
        /[^a-zA-Z0-9]/g,
        ''
      )||'jpg';

    const objectPath=[
      session.technician_id,
      id,
      `${photoType}-${Date.now()}.${extension}`,
    ].join('/');

    uploadedObjectPath=objectPath;

    const arrayBuffer=await file.arrayBuffer();
    const bytes=new Uint8Array(arrayBuffer);

    const {error:uploadError}=await supabase.storage
      .from(PHOTO_BUCKET)
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
      console.error(
        'service report storage upload error',
        uploadError
      );

      throw new Error(
        `사진 Storage 업로드 실패: ${uploadError.message}`
      );
    }

    const {data:publicUrlData}=supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(objectPath);

    const photoUrl=publicUrlData.publicUrl;

    if(!photoUrl){
      throw new Error(
        '업로드된 사진의 URL을 생성하지 못했습니다.'
      );
    }

    const {data:photo,error:photoInsertError}=await supabase
      .from('service_schedule_photos')
      .insert({
        schedule_id:id,
        technician_id:session.technician_id,
        photo_type:photoType,
        photo_url:photoUrl,
      })
      .select(`
        id,
        schedule_id,
        technician_id,
        photo_type,
        photo_url,
        created_at
      `)
      .single();

    if(photoInsertError){
      console.error(
        'service report photo insert error',
        photoInsertError
      );

      // DB 저장 실패 시 Storage 파일도 제거
      await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([objectPath]);

      uploadedObjectPath=null;

      throw new Error(
        `사진정보 DB 저장 실패: ${photoInsertError.message}`
      );
    }

    return NextResponse.json({
      success:true,
      data:photo,
    });
  }catch(error:any){
    if(error?.message==='TECHNICIAN_UNAUTHORIZED'){
      return unauthorizedResponse();
    }

    console.error('field report photo upload error',error);

    return NextResponse.json(
      {
        error:error?.message||'사진 업로드 오류',
      },
      {
        status:500,
      }
    );
  }
}

/**
 * 등록 사진 삭제
 */
export async function DELETE(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const supabase=getSupabaseServer();

    const photoId=new URL(req.url)
      .searchParams
      .get('photo_id');

    if(!photoId){
      return NextResponse.json(
        {
          error:'삭제할 사진 정보가 필요합니다.',
        },
        {
          status:400,
        }
      );
    }

    const {data:schedule,error:scheduleError}=await supabase
      .from('service_schedules')
      .select('id,assignee')
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .single();

    if(scheduleError||!schedule){
      return NextResponse.json(
        {
          error:'본인 일정의 사진만 삭제할 수 있습니다.',
        },
        {
          status:403,
        }
      );
    }

    const {data:photo,error:photoLoadError}=await supabase
      .from('service_schedule_photos')
      .select(`
        id,
        schedule_id,
        photo_url
      `)
      .eq('id',photoId)
      .eq('schedule_id',id)
      .single();

    if(photoLoadError||!photo){
      return NextResponse.json(
        {
          error:'삭제할 사진을 찾을 수 없습니다.',
        },
        {
          status:404,
        }
      );
    }

    /*
     * 공개 URL에서 Storage 내부 경로 추출
     *
     * 예:
     * .../storage/v1/object/public/service-report-photos/a/b/c.jpg
     */
    const pathMarker=
      `/storage/v1/object/public/${PHOTO_BUCKET}/`;

    const markerIndex=photo.photo_url.indexOf(pathMarker);

    if(markerIndex>=0){
      const storagePath=decodeURIComponent(
        photo.photo_url.slice(
          markerIndex+pathMarker.length
        )
      );

      const {error:storageDeleteError}=await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([storagePath]);

      if(storageDeleteError){
        console.error(
          'photo storage delete error',
          storageDeleteError
        );
      }
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
  }catch(error:any){
    if(error?.message==='TECHNICIAN_UNAUTHORIZED'){
      return unauthorizedResponse();
    }

    console.error('field report photo delete error',error);

    return NextResponse.json(
      {
        error:error?.message||'사진 삭제 오류',
      },
      {
        status:500,
      }
    );
  }
}
