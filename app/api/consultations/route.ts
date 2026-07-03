import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request){
  const body = await req.json();
  const { error } = await supabase.from('consultations').insert({
    name: body.name,
    phone: body.phone,
    service_type: body.service_type,
    region: body.region,
    model: body.model,
    message: body.message,
    status: 'new'
  });
  if(error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
