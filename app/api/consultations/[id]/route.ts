import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = getSupabaseAdmin()
  const body = await request.json().catch(() => ({}))

  const updateData = {
    status: body.status,
    manager: body.manager,
    memo: body.memo,
    quote_amount: body.quote_amount,
    visit_date: body.visit_date,
    updated_at: new Date().toISOString(),
  }

  Object.keys(updateData).forEach((key) => {
    if ((updateData as Record<string, unknown>)[key] === undefined) {
      delete (updateData as Record<string, unknown>)[key]
    }
  })

  if (!supabase) {
    return NextResponse.json({ ok: true, mode: 'mock', data: { id, ...updateData } })
  }

  const { data, error } = await supabase
    .from('consultations')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}
