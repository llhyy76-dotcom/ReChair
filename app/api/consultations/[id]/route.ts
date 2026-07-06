import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const body = await request.json()
  const supabase = getSupabaseClient()

  if (!supabase) {
    return NextResponse.json({ ok: true, mode: 'mock' })
  }

  const updatePayload: Record<string, any> = {}
  for (const key of ['status', 'assignee', 'memo', 'quote_amount']) {
    if (key in body) updatePayload[key] = body[key]
  }
  updatePayload.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('consultations')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  await supabase.from('consultation_events').insert({
    consultation_id: id,
    event_type: '상태변경',
    memo: `상태: ${body.status || '-'} / 담당자: ${body.assignee || '-'}`
  })

  return NextResponse.json({ ok: true, data })
}
