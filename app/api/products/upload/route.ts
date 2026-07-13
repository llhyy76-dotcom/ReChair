import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function POST(request:NextRequest){
  try{
    const form=await request.formData();
    const files=form.getAll('files').filter((v):v is File=>v instanceof File&&v.size>0);
    if(!files.length)return NextResponse.json({error:'업로드할 사진이 없습니다.'},{status:400});
    const supabase=getSupabaseServer();
    const urls:string[]=[];
    for(const file of files.slice(0,8)){
      const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';
      const path=`products/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const buffer=Buffer.from(await file.arrayBuffer());
      const {error}=await supabase.storage.from('product-photos').upload(path,buffer,{contentType:file.type||'image/jpeg',upsert:false});
      if(error)throw error;
      const {data}=supabase.storage.from('product-photos').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return NextResponse.json({urls});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'사진 업로드 오류'},{status:500});
  }
}
