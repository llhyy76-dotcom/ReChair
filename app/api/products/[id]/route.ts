import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Ctx = { params: Promise<{ id: string }> };

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json(null, { status: 404 });
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase env missing' }, { status: 400 });
  const body = await req.json();
  const { data, error } = await supabase.from('products').update(body).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase env missing' }, { status: 400 });
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
