import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type PhotoField = 'front_photo' | 'side_photo' | 'label_photo' | 'back_photo'

const PHOTO_FIELDS: PhotoField[] = ['front_photo', 'side_photo', 'label_photo', 'back_photo']

function safeText(value: FormDataEntryValue | null) {
  if (!value || value instanceof File) return ''
  return String(value).trim()
}

async function uploadPhoto(field: PhotoField, file: File, phone: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase || file.size === 0) return null

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const safePhone = phone.replace(/[^0-9]/g, '') || 'unknown'
  const filePath = `consultations/${Date.now()}-${safePhone}-${field}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error } = await supabase.storage
    .from('consultation-photos')
    .upload(filePath, Buffer.from(arrayBuffer), {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

  if (error) return null

  const { data } = supabase.storage.from('consultation-photos').getPublicUrl(filePath)
  return data.publicUrl
}

export async function GET() {
  const supabase = getSupabaseAdmin()

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      mode: 'mock',
      data: [
        {
          id: 'mock-1',
          name: '홍길동',
          phone: '010-0000-0000',
          service_type: '중고 안마의자 판매',
          model: '코지마 CMC-A100',
          message: '제품 매입 상담을 원합니다.',
          status: '신규',
          manager: '',
          memo: '',
          created_at: new Date().toISOString(),
          front_photo_url: null,
          side_photo_url: null,
          label_photo_url: null,
          back_photo_url: null,
        },
      ],
    })
  }

  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  const formData = await request.formData()

  const name = safeText(formData.get('name'))
  const phone = safeText(formData.get('phone'))
  const service_type = safeText(formData.get('service_type')) || safeText(formData.get('service'))
  const model = safeText(formData.get('model'))
  const message = safeText(formData.get('message'))

  if (!name || !phone) {
    return NextResponse.json({ ok: false, error: '이름과 연락처는 필수입니다.' }, { status: 400 })
  }

  const photoUrls: Record<string, string | null> = {
    front_photo_url: null,
    side_photo_url: null,
    label_photo_url: null,
    back_photo_url: null,
  }

  for (const field of PHOTO_FIELDS) {
    const value = formData.get(field)
    if (value instanceof File && value.size > 0) {
      const url = await uploadPhoto(field, value, phone)
      photoUrls[`${field}_url`] = url
    }
  }

  const payload = {
    name,
    phone,
    service_type,
    model,
    message,
    status: '신규',
    manager: '',
    memo: '',
    ...photoUrls,
  }

  if (!supabase) {
    return NextResponse.json({ ok: true, mode: 'mock', data: { id: 'mock-created', ...payload } })
  }

  const { data, error } = await supabase
    .from('consultations')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}
