'use client';

import { useMemo, useState } from 'react';

type PhotoKey = 'photo_front' | 'photo_side' | 'photo_label' | 'photo_back';

const photoGuides: Array<{ key: PhotoKey; title: string; desc: string; icon: string }> = [
  { key: 'photo_front', title: '앞면 사진', desc: '제품 전체가 보이도록 정면 촬영', icon: '🛋️' },
  { key: 'photo_side', title: '옆면 사진', desc: '팔걸이·다리부 상태 확인용', icon: '↔️' },
  { key: 'photo_label', title: '모델명/제품라벨', desc: '모델명과 제조번호가 보이게 촬영', icon: '🏷️' },
  { key: 'photo_back', title: '뒷면 사진', desc: '전원부·후면 커버 상태 확인용', icon: '🔌' }
];

export default function ConsultationForm() {
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const previewList = useMemo(() => Object.entries(previews), [previews]);

  function handleFileChange(key: string, file?: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviews((prev) => ({ ...prev, [key]: url }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setDone(false);

    const formData = new FormData(event.currentTarget);

    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        body: formData
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || '접수 실패');
      setDone(true);
      event.currentTarget.reset();
      setPreviews({});
    } catch (error) {
      alert(error instanceof Error ? error.message : '접수 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="consult" className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid gap-10 rounded-[2rem] bg-[#050917] p-8 text-white shadow-2xl lg:grid-cols-[0.85fr_1.15fr] lg:p-14">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">Free Quote</p>
          <h2 className="mt-5 text-4xl font-black leading-tight md:text-6xl">
            사진만 보내도 빠르게<br />상담받을 수 있습니다.
          </h2>
          <p className="mt-8 text-lg leading-8 text-slate-300">
            앞면, 옆면, 모델명 라벨, 뒷면 사진을 올려주시면 제품 상태를 더 정확하게 확인할 수 있습니다.
          </p>
        </div>

        <form onSubmit={onSubmit} className="rounded-[1.5rem] bg-white p-6 text-slate-950 shadow-xl">
          <div className="grid gap-4 md:grid-cols-2">
            <input name="name" required className="rounded-2xl border p-4" placeholder="이름" />
            <input name="phone" required className="rounded-2xl border p-4" placeholder="연락처" />
          </div>

          <select name="service_type" className="mt-4 w-full rounded-2xl border p-4">
            <option>중고 안마의자 판매</option>
            <option>중고 안마의자 구매</option>
            <option>이전설치</option>
            <option>폐기수거</option>
            <option>출장수리</option>
            <option>부품문의</option>
          </select>

          <input name="model" className="mt-4 w-full rounded-2xl border p-4" placeholder="브랜드/모델명 예: 코지마 CMC-A100" />
          <textarea name="message" rows={4} className="mt-4 w-full rounded-2xl border p-4" placeholder="문의 내용을 적어주세요" />

          <div className="mt-6">
            <h3 className="text-lg font-black">제품 사진 첨부</h3>
            <p className="mt-1 text-sm text-slate-500">사진을 많이 올릴수록 매입·판매 상담이 빨라집니다.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {photoGuides.map((item) => (
                <label key={item.key} className="cursor-pointer rounded-2xl border bg-slate-50 p-4 transition hover:border-blue-400 hover:bg-blue-50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <div className="font-black">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                  <input
                    className="mt-3 w-full text-sm"
                    type="file"
                    name={item.key}
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileChange(item.key, e.target.files?.[0])}
                  />
                  {previews[item.key] && (
                    <img src={previews[item.key]} alt={item.title} className="mt-3 h-32 w-full rounded-xl object-cover" />
                  )}
                </label>
              ))}
            </div>
          </div>

          <label className="mt-4 block rounded-2xl border border-dashed p-4 text-sm text-slate-600">
            추가 사진 업로드(선택)
            <input
              className="mt-3 w-full"
              type="file"
              name="extra_photos"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                files.slice(0, 10).forEach((file, i) => handleFileChange(`extra_${i}`, file));
              }}
            />
          </label>

          {previewList.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {previewList.slice(0, 8).map(([key, url]) => (
                <img key={key} src={url} alt="preview" className="h-20 rounded-xl object-cover" />
              ))}
            </div>
          )}

          <button disabled={loading} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 p-4 font-black text-white disabled:opacity-60">
            {loading ? '접수 중...' : '무료 상담 신청'}
          </button>
          {done && <p className="mt-3 text-center text-sm font-bold text-blue-600">접수가 완료되었습니다. 담당자가 연락드리겠습니다.</p>}
        </form>
      </div>
    </section>
  );
}
