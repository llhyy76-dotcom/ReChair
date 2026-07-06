'use client'

import { useMemo, useState } from 'react'

type PhotoField = {
  key: 'photo_front' | 'photo_side' | 'photo_label' | 'photo_back'
  title: string
  desc: string
  guide: string
}

const photoFields: PhotoField[] = [
  { key: 'photo_front', title: '앞면 사진', desc: '전체 외관이 보이게 촬영', guide: '정면 전체' },
  { key: 'photo_side', title: '옆면 사진', desc: '가죽/팔걸이 상태 확인', guide: '좌/우 측면' },
  { key: 'photo_label', title: '모델명/제품라벨', desc: '모델명과 제조번호 확인', guide: '제품 라벨' },
  { key: 'photo_back', title: '뒷면 사진', desc: '후면 커버와 전원부 확인', guide: '후면 전체' }
]

export default function ConsultationForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})

  const previewList = useMemo(() => previews, [previews])

  function handlePreview(key: string, file?: File) {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviews((prev) => ({ ...prev, [key]: url }))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const form = e.currentTarget
    const formData = new FormData(form)

    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        body: formData
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '접수 실패')
      setMessage('상담이 접수되었습니다. 담당자가 확인 후 연락드립니다.')
      form.reset()
      setPreviews({})
    } catch (err: any) {
      setMessage(err.message || '접수 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="consultation" className="quote-section">
      <div className="quote-copy">
        <p className="eyebrow">Free Quote</p>
        <h2>사진만 보내도 빠르게<br />상담받을 수 있습니다.</h2>
        <p>중고 구매·판매, 이전설치, 폐기수거, 출장수리, 부품문의 중 필요한 서비스를 선택해 주세요.</p>
      </div>

      <form className="quote-form" onSubmit={onSubmit}>
        <div className="form-grid two">
          <input name="name" placeholder="이름" required />
          <input name="phone" placeholder="연락처" required />
        </div>
        <select name="service" defaultValue="중고 안마의자 구매">
          <option>중고 안마의자 구매</option>
          <option>중고 안마의자 판매</option>
          <option>이전설치</option>
          <option>폐기수거</option>
          <option>출장수리</option>
          <option>부품문의</option>
        </select>
        <input name="model" placeholder="브랜드/모델명 예: 코지마 CMC-A100" />
        <textarea name="message" placeholder="문의 내용을 적어주세요" />

        <div className="photo-guide-wrap">
          <div className="photo-guide-head">
            <h3>제품 사진을 올려주세요</h3>
            <p>앞면·옆면·제품라벨·뒷면 사진을 올리면 더 정확한 상담이 가능합니다.</p>
          </div>
          <div className="photo-grid">
            {photoFields.map((field) => (
              <label className="photo-card" key={field.key}>
                <div className="photo-sample">
                  {previewList[field.key] ? (
                    <img src={previewList[field.key]} alt={field.title} />
                  ) : (
                    <div className="sample-box">
                      <span>📷</span>
                      <strong>{field.guide}</strong>
                    </div>
                  )}
                </div>
                <div className="photo-text">
                  <strong>{field.title}</strong>
                  <small>{field.desc}</small>
                </div>
                <input
                  type="file"
                  name={field.key}
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handlePreview(field.key, e.target.files?.[0])}
                />
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading}>{loading ? '접수 중...' : '무료 상담 신청'}</button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  )
}
