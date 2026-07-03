import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function POST(request: Request) {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Supabase 환경변수가 설정되지 않았습니다. Vercel Environment Variables에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 등록하세요.'
      },
      { status: 503 }
    );
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      name: body.name ?? '',
      phone: body.phone ?? '',
      service_type: body.service_type ?? body.serviceType ?? '',
      region: body.region ?? '',
      model: body.model ?? '',
      requested_date: body.requested_date ?? body.requestedDate ?? null,
      message: body.message ?? '',
      status: 'new'
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function GET() {
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json({ ok: true, data: [] });
  }

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
