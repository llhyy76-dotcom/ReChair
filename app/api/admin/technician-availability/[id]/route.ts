import {NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {requireAdmin} from '@/lib/adminAuth';

export async function DELETE(
  _req:Request,
  {params}:{params:Promise<{id:string}>}
){
  try{
    await requireAdmin();
    const {id}=await params;
    const supabase=getSupabaseServer();
    const {error}=await supabase
      .from('technician_availability')
      .delete()
      .eq('id',id);
    if(error)throw error;
    return NextResponse.json({success:true});
  }catch(error:any){
    if(error?.message==='ADMIN_UNAUTHORIZED'||error?.message==='UNAUTHORIZED'){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    return NextResponse.json({error:error?.message||'근무 설정 삭제 오류'},{status:500});
  }
}
