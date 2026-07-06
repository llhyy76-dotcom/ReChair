'use client'

import { useEffect, useMemo, useState } from 'react'

type Consultation = {
  id: string
  name: string
  phone: string
  service_type: string
  model: string
  message: string
  status: string
  manager?: string
  memo?: string
  quote_amount?: number
  visit_date?: string
  created_at: string
  front_photo_url?: string | null
  side_photo_url?: string | null
  label_photo_url?: string | null
  back_photo_url?: string | null
}

const STATUSES = ['신규', '상담중', '견적발송', '예약완료', '방문완료', '판매완료', '종료']
const PHOTO_LABELS = [
  ['front_photo_url', '앞면'],
  ['side_photo_url', '옆면'],
  ['label_photo_url', '제품라벨'],
  ['back_photo_url', '뒷면'],
] as const

export default function AdminConsultations() {
  const [items, setItems] = useState<Consultation[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/consultations', { cache: 'no-store' })
      const json = await res.json()
      if (json.ok) {
        setItems(json.data || [])
        if (!selectedId && json.data?.[0]) setSelectedId(json.data[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  async function update(id: string, patch: Partial<Consultation>) {
    const res = await fetch(`/api/consultations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (json.ok) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...json.data } : item)))
    } else {
      alert(json.error || '저장 실패')
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-600">ReChair Admin</p>
          <h1 className="mt-3 text-4xl font-black">관리자 상담 CRM</h1>
          <p className="mt-2 text-slate-500">고객 상담, 제품 사진, 처리 상태, 담당자 메모를 한 화면에서 관리합니다.</p>
        </div>
        <button onClick={load} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">새로고침</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">상담 접수 CRM</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-600">{items.length}건</span>
          </div>
          <div className="space-y-3">
            {loading && <p className="text-slate-500">불러오는 중...</p>}
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selected?.id === item.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-black">{item.name}</p>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{item.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{item.service_type}</p>
                <p className="mt-1 text-sm font-bold">{item.model}</p>
              </button>
            ))}
          </div>
        </aside>

        {selected && (
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-black text-blue-600">{selected.service_type}</p>
            <h2 className="mt-2 text-3xl font-black">{selected.name}</h2>
            <p className="mt-1 text-slate-500">{selected.phone}</p>

            <select
              value={selected.status}
              onChange={(e) => update(selected.id, { status: e.target.value })}
              className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 font-bold"
            >
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">브랜드/모델</p>
                <p className="mt-2 text-xl font-black">{selected.model || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">접수일</p>
                <p className="mt-2 text-xl font-black">{new Date(selected.created_at).toLocaleString('ko-KR')}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-bold text-slate-500">문의 내용</p>
              <p className="mt-2 leading-7">{selected.message || '-'}</p>
            </div>

            <h3 className="mt-6 text-xl font-black">첨부 사진</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {PHOTO_LABELS.map(([key, label]) => {
                const url = selected[key]
                return (
                  <a key={key} href={url || '#'} target="_blank" className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center" rel="noreferrer">
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-white">
                      {url ? <img src={url} alt={label} className="h-full w-full object-cover" /> : <span className="text-4xl">📷</span>}
                    </div>
                    <p className="mt-2 text-sm font-bold">{label}</p>
                  </a>
                )
              })}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <input defaultValue={selected.manager || ''} onBlur={(e) => update(selected.id, { manager: e.target.value })} placeholder="담당자" className="rounded-xl border border-slate-200 px-4 py-3" />
              <input type="number" defaultValue={selected.quote_amount || ''} onBlur={(e) => update(selected.id, { quote_amount: Number(e.target.value || 0) })} placeholder="예상 견적/매출" className="rounded-xl border border-slate-200 px-4 py-3" />
            </div>
            <textarea defaultValue={selected.memo || ''} onBlur={(e) => update(selected.id, { memo: e.target.value })} placeholder="관리자 메모" className="mt-4 h-28 w-full rounded-xl border border-slate-200 px-4 py-3" />
          </article>
        )}
      </div>
    </section>
  )
}
