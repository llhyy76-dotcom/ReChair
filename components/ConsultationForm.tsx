'use client'

import { useMemo, useState } from 'react'

type PhotoKey = 'front_photo' | 'side_photo' | 'label_photo' | 'back_photo'

const PHOTO_GUIDE: { key: PhotoKey; title: string; desc: string; icon: string }[] = [
  { key: 'front_photo', title: '앞면 사진', desc: '제품 전체가 보이도록 정면에서 촬영', icon: '🛋️' },
  { key: 'side_photo', title: '옆면 사진', desc: '팔걸이·가죽 상태가 보이도록 촬영', icon: '↔️' },
  { key: 'label_photo', title: '제품라벨', desc: '모델명·제조번호 라벨을 가까이 촬영', icon: '🏷️' },
  { key: 'back_photo', title: '뒷면 사진', desc: '전원선·뒷커버 상태가 보이도록 촬영', icon: '🔌' },
]

export default function ConsultationForm() {
  const [loading, setLoading] = useState(false)
  const [previews, setPreviews] = useState<Record<PhotoKey, string | null>>({
    front_photo: null,
    side_photo: null,
    label_photo: null,
    back_photo: null,
  })

  const hasPreview = useMemo(() => Object.values(previews).some(Boolean), [previews])

  function onFileChange(key: PhotoKey, file?: File) {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviews((prev) => ({ ...prev, [key]: url }))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    const form = event.currentTarget
    const formData = new FormData(form)

    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || '접수 실패')
      alert('상담 신청이 접수되었습니다. 담당자가 빠르게 연락드리겠습니다.')
      form.reset()
      setPreviews({ front_photo: null, side_photo: null, label_photo: null, back_photo: null })
    } catch (error) {
      alert(error instanceof Error ? error.message : '접수 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="consult" className="mx-auto max-w-7xl px-5 py-16">
      <div className="grid gap-8 rounded-[2rem] bg-[#050a1a] p-8 text-white lg:grid-cols-[0.9fr_1.1fr] lg:p-14">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Free Quote</p>
          <h2 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
            사진만 보내도 빠르게<br />상담받을 수 있습니다.
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            중고 구매·판매, 이전설치, 폐기수거, 출장수리, 부품문의 중 필요한 서비스를 선택해 주세요.
          </p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            사진은 앞면·옆면·제품라벨·뒷면 순서로 올려주시면 견적 정확도가 높아집니다.
          </div>
        </div>

        <form onSubmit={onSubmit} className="rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-2xl md:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            <input name="name" required placeholder="이름" className="rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-blue-500" />
            <input name="phone" required placeholder="연락처" className="rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-blue-500" />
          </div>

          <select name="service_type" className="mt-4 w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-blue-500">
            <option>중고 안마의자 구매</option>
            <option>중고 안마의자 판매</option>
            <option>이전설치</option>
            <option>폐기수거</option>
            <option>출장수리</option>
            <option>부품문의</option>
          </select>

          <input name="model" placeholder="브랜드/모델명 예: 코지마 CMC-A100" className="mt-4 w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-blue-500" />
          <textarea name="message" placeholder="문의 내용을 적어주세요" className="mt-4 h-32 w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg outline-none focus:border-blue-500" />

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black">제품 상태 사진</h3>
              <span className="text-xs font-bold text-blue-600">휴대폰 카메라 촬영 가능</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {PHOTO_GUIDE.map((item) => (
                <label key={item.key} className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-400 hover:bg-blue-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                      {previews[item.key] ? <img src={previews[item.key] || ''} alt="preview" className="h-full w-full rounded-2xl object-cover" /> : item.icon}
                    </div>
                    <div>
                      <p className="font-black">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  <input
                    name={item.key}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mt-3 block w-full text-sm text-slate-500"
                    onChange={(e) => onFileChange(item.key, e.target.files?.[0])}
                  />
                </label>
              ))}
            </div>
            {hasPreview && <p className="mt-3 text-xs text-slate-500">첨부된 사진은 관리자 화면에서 확인할 수 있습니다.</p>}
          </div>

          <button disabled={loading} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-5 text-lg font-black text-white shadow-lg disabled:opacity-60">
            {loading ? '접수 중...' : '무료 상담 신청'}
          </button>
        </form>
      </div>
    </section>
  )
}
