import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {signConsultationPhotoRow} from '@/lib/consultationPhotoAccess';
const STATUS=['신규','상담중','견적발송','예약완료','방문완료','판매완료','종료'];


export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const supabase=getSupabaseServer();
    const {data,error}=await supabase
      .from('consultations')
      .select('*')
      .eq('id',id)
      .single();
    if(error)throw error;
    return NextResponse.json({data:await signConsultationPhotoRow(supabase,data)});
  }catch(e:any){
    console.error('admin consultation get error',e);
    return NextResponse.json({error:e?.message||'상담 조회 오류'},{status:500});
  }
}

export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const b=await req.json();
    if(b.status!==undefined&&!STATUS.includes(String(b.status))){
      return NextResponse.json({error:'허용되지 않은 상태입니다.'},{status:400});
    }

    const payload:any={updated_at:new Date().toISOString()};
    if(b.status!==undefined)payload.status=b.status;
    if(b.assignee!==undefined)payload.assignee=String(b.assignee||'').trim()||null;
    if(b.memo!==undefined)payload.memo=String(b.memo||'').trim()||null;
    if(b.estimate_amount!==undefined)payload.estimate_amount=Number(b.estimate_amount||0);
    if(b.next_action_at!==undefined)payload.next_action_at=b.next_action_at||null;
    if(b.region!==undefined)payload.region=String(b.region||'').trim()||null;
    if(b.address!==undefined)payload.address=String(b.address||'').trim()||null;

    const supabase=getSupabaseServer();
    const {data,error}=await supabase
      .from('consultations')
      .update(payload)
      .eq('id',id)
      .select('*')
      .single();
    if(error)throw error;
    return NextResponse.json({data:await signConsultationPhotoRow(supabase,data)});
  }catch(e:any){
    console.error('admin consultation patch error',e);
    return NextResponse.json({error:e?.message||'상담 저장 오류'},{status:500});
  }
}
