import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function supabasePatch(id: string, body: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/consultations?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Supabase update failed');
  }

  return res.json();
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const data = await supabasePatch(id, {
      status: body.status,
      manager: body.manager,
      memo: body.memo
    });

    return NextResponse.json({ ok: true, updated: Boolean(data), data: data?.[0] || { id, ...body } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
