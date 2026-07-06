import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, photoFields } from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){
 const supabase=getSupabase();
 if(!supabase) return NextResponse.json({items:[]});
 const {data,error}=await supabase.from('consultations').select('*').order('created_at',{ascending:false});
 if(error) return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({items:data||[]});
}
export async function POST(req:NextRequest){
 const supabase=getSupabase(); const form=await req.formData();
 const base:any={name:String(form.get('name')||''),phone:String(form.get('phone')||''),service_type:String(form.get('service_type')||''),model:String(form.get('model')||''),message:String(form.get('message')||''),status:'신규'};
 const photoUrls:Record<string,string>={};
 if(supabase){
  for(const field of photoFields){
    const file=form.get(field);
    if(file instanceof File && file.size>0){
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=`${Date.now()}-${field}-${safe}`;
      const {error:upErr}=await supabase.storage.from('consultation-photos').upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'});
      if(!upErr){ const {data}=supabase.storage.from('consultation-photos').getPublicUrl(path); photoUrls[field]=data.publicUrl; }
    }
  }
  const {data,error}=await supabase.from('consultations').insert({...base,...photoUrls}).select().single();
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,item:data});
 }
 return NextResponse.json({ok:true,item:{...base,...photoUrls,created_at:new Date().toISOString()}});
}
