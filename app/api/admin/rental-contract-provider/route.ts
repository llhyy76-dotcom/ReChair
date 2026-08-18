import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/adminAuth';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  sanitizeRentalProviderSettings,
  validateRentalProviderSettings,
} from '@/lib/rentalContract';

export const dynamic='force-dynamic';

function unauthorized(error:unknown){
  return error instanceof Error&&error.message==='ADMIN_UNAUTHORIZED';
}

export async function GET(){
  try{
    await requireAdmin();
    const supabase=getSupabaseServer();
    const {data,error}=await supabase
      .from('rental_contract_provider_settings')
      .select('*')
      .eq('id',1)
      .maybeSingle();
    if(error)throw error;

    if(data){
      return NextResponse.json({data:sanitizeRentalProviderSettings(data),configured:true});
    }

    const {data:previous,error:previousError}=await supabase
      .from('rental_contracts')
      .select('document_snapshot')
      .order('created_at',{ascending:false})
      .limit(1);
    if(previousError)throw previousError;

    return NextResponse.json({
      data:sanitizeRentalProviderSettings(previous?.[0]?.document_snapshot?.provider||{}),
      configured:false,
    });
  }catch(error){
    if(unauthorized(error)){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('rental contract provider get error',error);
    return NextResponse.json({
      error:error instanceof Error?error.message:'공급자 기본정보 조회 오류',
    },{status:500});
  }
}

export async function PATCH(request:NextRequest){
  try{
    await requireAdmin();
    const body=await request.json();
    const provider=sanitizeRentalProviderSettings(body);
    const missing=validateRentalProviderSettings(provider);
    if(missing.length){
      return NextResponse.json({
        error:`공급자 기본정보를 확인해 주세요: ${missing.join(', ')}`,
      },{status:400});
    }

    const supabase=getSupabaseServer();
    const {data,error}=await supabase
      .from('rental_contract_provider_settings')
      .upsert({
        id:1,
        ...provider,
        updated_at:new Date().toISOString(),
      },{onConflict:'id'})
      .select('*')
      .single();
    if(error)throw error;

    return NextResponse.json({
      data:sanitizeRentalProviderSettings(data),
      configured:true,
    });
  }catch(error){
    if(unauthorized(error)){
      return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401});
    }
    console.error('rental contract provider save error',error);
    return NextResponse.json({
      error:error instanceof Error?error.message:'공급자 기본정보 저장 오류',
    },{status:500});
  }
}
