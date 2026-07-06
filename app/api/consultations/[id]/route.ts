import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const supabase = getSupabaseClient();

  const updatePayload = {
    status: body.status,
    assignee: body.assignee,
    memo: body.memo,
    estimate_amount: body.estimate_amount ? Number(body.estimate_amount) : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('consultations')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
