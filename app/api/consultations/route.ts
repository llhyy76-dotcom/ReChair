import { NextResponse } from 'next/server'
import { getSupabaseClient, hasSupabaseEnv } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type PhotoRow = {
  consultation_id: string
  field: string
  file_name: string
  public_url: string
}

const photoFields = ['photo_front', 'photo_side', 'photo_label', 'photo_back']

function mockData() {
  return [
    {
      id: 'mock-1',
      name: '홍길동',
      phone: '010-0000-0000',
      service: '중고 안마의자 판매',
      model: '코지마 CMC-A100',
      message: '제품 매입 상담을 원합니다.',
      status: '신규',
      assignee: '',
      memo: '',
      quote_amount: '',
      created_at: new Date().toISOString(),
      photos: []
    }
  ]
}

export async function GET() {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ ok: true, data: mockData(), mode: 'mock' })
  }

  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, data: mockData() }, { status: 200 })
  }

  const ids = (data || []).map((item: any) => item.id)
  let photos: any[] = []
  if (ids.length) {
    const photoResult = await supabase
      .from('consultation_photos')
      .select('*')
      .in('consultation_id', ids)
    photos = photoResult.data || []
  }

  const mapped = (data || []).map((item: any) => ({
    ...item,
    photos: photos.filter((p) => p.consultation_id === item.id)
  }))

  return NextResponse.json({ ok: true, data: mapped, mode: 'live' })
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const name = String(formData.get('name') || '')
  const phone = String(formData.get('phone') || '')
  const service = String(formData.get('service') || '')
  const model = String(formData.get('model') || '')
  const message = String(formData.get('message') || '')

  if (!name || !phone) {
    return NextResponse.json({ ok: false, error: '이름과 연락처는 필수입니다.' }, { status: 400 })
  }

  const supabase = getSupabaseClient()
  if (!supabase || !hasSupabaseEnv()) {
    return NextResponse.json({ ok: true, mode: 'mock', message: '접수되었습니다. Supabase 환경변수 설정 후 실제 저장됩니다.' })
  }

  const { data: consultation, error: insertError } = await supabase
    .from('consultations')
    .insert({
      name,
      phone,
      service,
      model,
      message,
      status: '신규'
    })
    .select('*')
    .single()

  if (insertError || !consultation) {
    return NextResponse.json({ ok: false, error: insertError?.message || '상담 저장 실패' }, { status: 500 })
  }

  const uploadedPhotos: PhotoRow[] = []

  for (const field of photoFields) {
    const value = formData.get(field)
    if (!(value instanceof File) || value.size === 0) continue

    const ext = value.name.split('.').pop() || 'jpg'
    const safeName = `${consultation.id}/${field}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('consultation-photos')
      .upload(safeName, value, {
        cacheControl: '3600',
        upsert: true,
        contentType: value.type || 'image/jpeg'
      })

    if (uploadError) continue

    const { data: publicUrlData } = supabase.storage
      .from('consultation-photos')
      .getPublicUrl(safeName)

    uploadedPhotos.push({
      consultation_id: consultation.id,
      field,
      file_name: value.name,
      public_url: publicUrlData.publicUrl
    })
  }

  if (uploadedPhotos.length) {
    await supabase.from('consultation_photos').insert(uploadedPhotos)
  }

  return NextResponse.json({ ok: true, data: { ...consultation, photos: uploadedPhotos } })
}
