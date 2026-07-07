import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
    }

    const { id } = await params;
    const body = await request.json();

    const quoteValue = body.quote_amount === '' || body.quote_amount === undefined
      ? null
      : body.quote_amount;

    const payload = {
      status: body.status ?? '신규',
      manager: body.manager ?? '',
      memo: body.memo ?? '',
      quote_amount: quoteValue === null ? null : Number(quoteValue),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('consultations')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
