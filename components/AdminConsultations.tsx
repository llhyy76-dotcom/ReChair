'use client'

import { useEffect, useMemo, useState } from 'react'

type Photo = {
  id?: string
  field: string
  public_url: string
  file_name?: string
}

type Consultation = {
  id: string
  name: string
  phone: string
  service: string
  model: string
  message: string
  status: string
  assignee?: string
  memo?: string
  quote_amount?: string
  created_at: string
  photos?: Photo[]
}

const fieldLabels: Record<string, string> = {
  photo_front: '앞면',
  photo_side: '옆면',
  photo_label: '제품라벨',
  photo_back: '뒷면'
}

export default function AdminConsultations() {
  const [items, setItems] = useState<Consultation[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState<string>('')

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || items[0],
    [items, selectedId]
  )

  async function load() {
    setLoading(true)
    const res = await fetch('/api/consultations', { cache: 'no-store' })
    const json = await res.json()
    const data = json.data || []
    setItems(data)
    if (!selectedId && data[0]) setSelectedId(data[0].id)
    setLoading(false)
  }

  async function update(id: string, patch: Partial<Consultation>) {
    await fetch(`/api/consultations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    })
    await load()
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="admin-crm">
      <div className="admin-toolbar">
        <button onClick={load}>{loading ? '불러오는 중...' : '새로고침'}</button>
      </div>
      <div className="crm-layout">
        <aside className="crm-list">
          <div className="crm-list-head">
            <h2>상담 접수 CRM</h2>
            <span>{items.length}건</span>
          </div>
          {items.map((item) => (
            <button
              className={`crm-item ${selected?.id === item.id ? 'active' : ''}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <strong>{item.name}</strong>
              <small>{item.service}</small>
              <b>{item.model || '-'}</b>
              <span>{item.status || '신규'}</span>
            </button>
          ))}
        </aside>

        <section className="crm-detail">
          {selected ? (
            <>
              <p className="eyebrow">{selected.service}</p>
              <h1>{selected.name}</h1>
              <p>{selected.phone}</p>

              <select
                value={selected.status || '신규'}
                onChange={(e) => update(selected.id, { status: e.target.value })}
              >
                {['신규', '상담중', '견적발송', '예약완료', '방문완료', '판매완료', '종료'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>

              <div className="info-grid">
                <div><small>브랜드/모델</small><strong>{selected.model || '-'}</strong></div>
                <div><small>접수일</small><strong>{new Date(selected.created_at).toLocaleString('ko-KR')}</strong></div>
              </div>

              <div className="message-box">
                <small>문의 내용</small>
                <p>{selected.message || '-'}</p>
              </div>

              <h3>첨부 사진</h3>
              <div className="admin-photo-grid">
                {selected.photos && selected.photos.length ? selected.photos.map((photo) => (
                  <button key={`${photo.field}-${photo.public_url}`} onClick={() => setLightbox(photo.public_url)}>
                    <img src={photo.public_url} alt={fieldLabels[photo.field] || photo.field} />
                    <span>{fieldLabels[photo.field] || photo.field}</span>
                  </button>
                )) : (
                  <p className="empty-photo">첨부 사진이 없습니다.</p>
                )}
              </div>

              <div className="admin-edit-grid">
                <input placeholder="담당자" defaultValue={selected.assignee || ''} onBlur={(e) => update(selected.id, { assignee: e.target.value })} />
                <input placeholder="견적금액" defaultValue={selected.quote_amount || ''} onBlur={(e) => update(selected.id, { quote_amount: e.target.value })} />
                <textarea placeholder="관리자 메모" defaultValue={selected.memo || ''} onBlur={(e) => update(selected.id, { memo: e.target.value })} />
              </div>
            </>
          ) : (
            <div className="empty-state">상담 접수가 없습니다.</div>
          )}
        </section>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox('')}>
          <img src={lightbox} alt="원본 사진" />
        </div>
      )}
    </div>
  )
}
