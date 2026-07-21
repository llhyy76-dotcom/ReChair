import {NextRequest,NextResponse} from 'next/server';
import {requireTechnicianSession} from '@/lib/technicianAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';

function decodeDataUrl(dataUrl:string){
  const match=dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if(!match)throw new Error('서명 이미지 형식이 올바르지 않습니다.');
  return Buffer.from(match[1],'base64');
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const session=await requireTechnicianSession();
    const {id}=await params;
    const {signature_data_url}=await req.json();
    if(!signature_data_url)return NextResponse.json({error:'고객 서명이 필요합니다.'},{status:400});
    const supabase=getSupabaseServer();
    const {data:schedule,error:scheduleError}=await supabase.from('service_schedules').select('id,assignee').eq('id',id).eq('assignee',session.technician.name).single();
    if(scheduleError||!schedule)return NextResponse.json({error:'본인 일정만 서명을 등록할 수 있습니다.'},{status:403});
    const objectPath=[session.technician_id,id,`signature-${Date.now()}.png`].join('/');
    const {error:uploadError}=await supabase.storage.from('service-signatures').upload(objectPath,decodeDataUrl(String(signature_data_url)),{contentType:'image/png',upsert:false});
    if(uploadError)throw uploadError;
    const {data:publicUrlData}=supabase.storage.from('service-signatures').getPublicUrl(objectPath);
    const {data,error}=await supabase.from('service_schedules').update({customer_signature_url:publicUrlData.publicUrl,customer_confirmation:'고객 서명 완료',field_report_updated_at:new Date().toISOString()}).eq('id',id).eq('assignee',session.technician.name).select('*').single();
    if(error)throw error;
    return NextResponse.json({success:true,data,url:publicUrlData.publicUrl});
  }catch(e:any){
    if(e?.message==='TECHNICIAN_UNAUTHORIZED')return NextResponse.json({error:'기사 로그인이 필요합니다.'},{status:401});
    return NextResponse.json({error:e?.message||'고객 서명 저장 오류'},{status:500});
  }
}
