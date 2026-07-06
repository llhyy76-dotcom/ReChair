import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  if (!supabase) return NextResponse.json({ ok: true, mock: true });

  const update = {
    status: body.status,
    manager: body.manager,
    memo: body.memo,
    quote_amount: body.quote_amount ? Number(body.quote_amount) : null,
    updated_at: new Date().toISOString()
  };

  const { data: prev } = await supabase.from('consultations').select('timeline').eq('id', id).single();
  const timeline = Array.isArray(prev?.timeline) ? prev.timeline : [];
  timeline.push({ at: new Date().toISOString(), label: `상태 변경: ${body.status || '수정'}` });

  const { data, error } = await supabase
    .from('consultations')
    .update({ ...update, timeline })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
