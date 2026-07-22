import {NextRequest,NextResponse} from 'next/server';
import {requireTechnicianSession} from '@/lib/technicianAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';

const SIGNATURE_BUCKET='service-signatures';

function unauthorizedResponse(){
  return NextResponse.json(
    {error:'기사 로그인이 필요합니다.'},
    {status:401}
  );
}

function extractStoragePath(signatureUrl:string){
  const marker=
    `/storage/v1/object/public/${SIGNATURE_BUCKET}/`;

  const index=signatureUrl.indexOf(marker);

  if(index<0){
    return null;
  }

  return decodeURIComponent(
    signatureUrl.slice(index+marker.length)
  );
}

/**
 * 고객 서명 저장
 */
export async function POST(
  req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const body=await req.json();

    const signatureDataUrl=String(
      body.signature_data_url||''
    );

    if(!signatureDataUrl.startsWith('data:image/png;base64,')){
      return NextResponse.json(
        {error:'올바른 서명 이미지가 아닙니다.'},
        {status:400}
      );
    }

    const supabase=getSupabaseServer();

    const {data:schedule,error:scheduleError}=await supabase
      .from('service_schedules')
      .select('id,assignee,customer_signature_url')
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .single();

    if(scheduleError||!schedule){
      return NextResponse.json(
        {error:'본인 일정에만 서명을 등록할 수 있습니다.'},
        {status:403}
      );
    }

    const base64=signatureDataUrl.split(',')[1];

    if(!base64){
      return NextResponse.json(
        {error:'서명 이미지 데이터가 없습니다.'},
        {status:400}
      );
    }

    const bytes=Buffer.from(base64,'base64');

    const objectPath=[
      session.technician_id,
      id,
      `signature-${Date.now()}.png`,
    ].join('/');

    const {error:uploadError}=await supabase.storage
      .from(SIGNATURE_BUCKET)
      .upload(objectPath,bytes,{
        contentType:'image/png',
        cacheControl:'3600',
        upsert:false,
      });

    if(uploadError){
      throw new Error(
        `서명 이미지 업로드 실패: ${uploadError.message}`
      );
    }

    const {data:publicUrlData}=supabase.storage
      .from(SIGNATURE_BUCKET)
      .getPublicUrl(objectPath);

    const signatureUrl=publicUrlData.publicUrl;

    const {data:updated,error:updateError}=await supabase
      .from('service_schedules')
      .update({
        customer_signature_url:signatureUrl,
        customer_signed_at:new Date().toISOString(),
        field_report_updated_at:new Date().toISOString(),
      })
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .select('*')
      .single();

    if(updateError){
      await supabase.storage
        .from(SIGNATURE_BUCKET)
        .remove([objectPath]);

      throw updateError;
    }

    // 기존 서명이 있었다면 새 서명 저장 후 Storage에서 제거
    if(schedule.customer_signature_url){
      const oldPath=extractStoragePath(
        schedule.customer_signature_url
      );

      if(oldPath){
        await supabase.storage
          .from(SIGNATURE_BUCKET)
          .remove([oldPath]);
      }
    }

    return NextResponse.json({
      success:true,
      data:updated,
    });
  }catch(error:any){
    if(error?.message==='TECHNICIAN_UNAUTHORIZED'){
      return unauthorizedResponse();
    }

    console.error('signature save error',error);

    return NextResponse.json(
      {error:error?.message||'고객 서명 저장 오류'},
      {status:500}
    );
  }
}

/**
 * 기존 고객 서명 삭제 및 다시 받기 상태로 변경
 */
export async function DELETE(
  _req:NextRequest,
  {params}:{params:Promise<{id:string}>}
){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const supabase=getSupabaseServer();

    const {data:schedule,error:scheduleError}=await supabase
      .from('service_schedules')
      .select('id,assignee,customer_signature_url')
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .single();

    if(scheduleError||!schedule){
      return NextResponse.json(
        {error:'본인 일정의 서명만 삭제할 수 있습니다.'},
        {status:403}
      );
    }

    const oldSignatureUrl=
      schedule.customer_signature_url;

    /*
     * DB 값을 먼저 비웁니다.
     * 이 부분이 실행되어야 화면에서 기존 서명이 사라집니다.
     */
    const {data:updated,error:updateError}=await supabase
      .from('service_schedules')
      .update({
  customer_signature_url:null,
  field_report_updated_at:new Date().toISOString(),
})
      .eq('id',id)
      .eq('assignee',session.technician.name)
      .select('*')
      .single();

    if(updateError){
      throw updateError;
    }

    // DB 초기화 성공 후 Storage 원본 파일 제거
    if(oldSignatureUrl){
      const storagePath=extractStoragePath(
        oldSignatureUrl
      );

      if(storagePath){
        const {error:storageError}=await supabase.storage
          .from(SIGNATURE_BUCKET)
          .remove([storagePath]);

        if(storageError){
          console.error(
            'signature storage delete error',
            storageError
          );
        }
      }
    }

    return NextResponse.json({
      success:true,
      data:updated,
    });
  }catch(error:any){
    if(error?.message==='TECHNICIAN_UNAUTHORIZED'){
      return unauthorizedResponse();
    }

    console.error('signature reset error',error);

    return NextResponse.json(
      {error:error?.message||'서명 초기화 오류'},
      {status:500}
    );
  }
}
