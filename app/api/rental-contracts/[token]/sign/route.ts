import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  RENTAL_CONTRACT_COOKIE,
  RENTAL_CONTRACT_SIGNATURE_BUCKET,
  hashRentalContractAccessToken,
  verifyRentalContractSession,
} from '@/lib/rentalContract';

export const dynamic='force-dynamic';

function response(body:Record<string,unknown>,status=200){
  const result=NextResponse.json(body,{status});
  result.headers.set('Cache-Control','no-store, max-age=0');
  result.headers.set('Referrer-Policy','no-referrer');
  result.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  return result;
}

function sameName(a:unknown,b:unknown){
  const normalize=(value:unknown)=>String(value||'').replace(/\s+/g,'').trim();
  return normalize(a)!==''&&normalize(a)===normalize(b);
}

export async function POST(
  request:NextRequest,
  {params}:{params:Promise<{token:string}>}
){
  let uploadedPath='';
  try{
    const {token}=await params;
    const tokenHash=hashRentalContractAccessToken(token);
    const supabase=getSupabaseServer();
    const {data:contract,error:contractError}=await supabase
      .from('rental_contracts')
      .select('*')
      .eq('access_token_hash',tokenHash)
      .maybeSingle();
    if(contractError)throw contractError;
    if(!contract)return response({error:'계약서 링크가 올바르지 않습니다.'},404);
    if(contract.status!=='sent'){
      return response({error:contract.status==='signed'?'이미 서명이 완료된 계약서입니다.':'현재 서명할 수 없는 계약서입니다.'},409);
    }
    if(contract.access_expires_at&&new Date(contract.access_expires_at).getTime()<Date.now()){
      return response({error:'계약서 서명 기한이 끝났습니다. 담당자에게 새 링크를 요청해 주세요.'},410);
    }

    const cookieStore=await cookies();
    if(!verifyRentalContractSession(
      cookieStore.get(RENTAL_CONTRACT_COOKIE)?.value,
      contract.id,
      tokenHash
    ))return response({error:'연락처 확인 후 다시 서명해 주세요.'},401);

    const body=await request.json();
    if(body.contract_consent!==true||body.privacy_consent!==true){
      return response({error:'계약내용과 개인정보 처리 안내에 모두 동의해 주세요.'},400);
    }
    const signerName=String(body.signer_name||'').trim().slice(0,80);
    if(!sameName(signerName,contract.document_snapshot?.customer?.name)){
      return response({error:'계약서의 고객 이름과 서명자 이름이 일치하지 않습니다.'},400);
    }

    const signatureData=String(body.signature_data_url||'');
    if(!signatureData.startsWith('data:image/png;base64,')){
      return response({error:'서명을 직접 작성해 주세요.'},400);
    }
    const encoded=signatureData.split(',')[1]||'';
    if(!encoded)return response({error:'서명 이미지가 비어 있습니다.'},400);
    if(encoded.length>3*1024*1024)return response({error:'서명 이미지가 너무 큽니다.'},400);
    const bytes=Buffer.from(encoded,'base64');
    if(bytes.length<100||bytes.length>2*1024*1024){
      return response({error:'서명 이미지 크기가 올바르지 않습니다.'},400);
    }
    if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){
      return response({error:'올바른 PNG 서명 이미지가 아닙니다.'},400);
    }

    uploadedPath=[
      contract.consultation_id,
      contract.id,
      `v${contract.version}-signature-${Date.now()}.png`,
    ].join('/');
    const {error:uploadError}=await supabase.storage
      .from(RENTAL_CONTRACT_SIGNATURE_BUCKET)
      .upload(uploadedPath,bytes,{
        contentType:'image/png',
        cacheControl:'3600',
        upsert:false,
      });
    if(uploadError)throw new Error(`서명 저장 실패: ${uploadError.message}`);

    const signedAt=new Date().toISOString();
    const {data:completed,error:completeError}=await supabase.rpc('complete_rental_contract',{
      p_contract_id:contract.id,
      p_signature_path:uploadedPath,
      p_signer_name:signerName,
      p_signed_at:signedAt,
    });
    if(completeError){
      await supabase.storage.from(RENTAL_CONTRACT_SIGNATURE_BUCKET).remove([uploadedPath]);
      uploadedPath='';
      throw completeError;
    }

    const completedRow=Array.isArray(completed)?completed[0]:completed;
    if(!completedRow)throw new Error('전자서명 완료 정보를 확인할 수 없습니다.');

    return response({
      success:true,
      data:{
        id:completedRow.id,
        contract_no:completedRow.contract_no,
        status:completedRow.status,
        signed_at:completedRow.signed_at,
      },
    });
  }catch(error){
    console.error('rental contract signing error',error);
    const raw=error instanceof Error?error.message:'';
    const message=raw.includes('RENTAL_CONTRACT_NOT_SIGNABLE')
      ?'이미 처리되었거나 현재 서명할 수 없는 계약서입니다.'
      :raw.includes('RENTAL_CONTRACT_LINK_EXPIRED')
        ?'계약서 서명 기한이 끝났습니다. 담당자에게 새 링크를 요청해 주세요.'
        :raw.includes('RENTAL_CONTRACT_PHONE_NOT_VERIFIED')
          ?'연락처 확인 후 다시 서명해 주세요.'
          :raw||'계약서 서명 오류';
    const status=raw.includes('RENTAL_CONTRACT_NOT_SIGNABLE')
      ?409
      :raw.includes('RENTAL_CONTRACT_LINK_EXPIRED')
        ?410
        :raw.includes('RENTAL_CONTRACT_PHONE_NOT_VERIFIED')
          ?401
          :500;
    return response({error:message},status);
  }
}
