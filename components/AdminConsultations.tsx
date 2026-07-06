'use client';

import { useEffect, useMemo, useState } from 'react';

type Consultation = {
  id: string;
  name: string;
  phone: string;
  service_type: string;
  model?: string;
  message?: string;
  status?: string;
  manager?: string;
  memo?: string;
  quote_amount?: number;
  photo_front?: string | null;
  photo_side?: string | null;
  photo_label?: string | null;
  photo_back?: string | null;
  extra_photos?: string[];
  timeline?: Array<{ at: string; label: string }>;
  created_at?: string;
};

const labels = [
  ['photo_front', '앞면'],
  ['photo_side', '옆면'],
  ['photo_label', '제품라벨'],
  ['photo_back', '뒷면']
] as const;

export default function AdminConsultations() {
  const [items, setItems] = useState<Consultation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/consultations', { cache: 'no-store' });
      const json = await res.json();
      const data = json.data || [];
      setItems(data);
      if (!selectedId && data[0]) setSelectedId(data[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateSelected(patch: Partial<Consultation>) {
    if (!selected) return;
    const res = await fetch(`/api/consultations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...selected, ...patch })
    });
    const json = await res.json();
    if (json.data) {
      setItems((prev) => prev.map((item) => (item.id === selected.id ? json.data : item)));
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-black uppercase tracking-[0.3em] text-blue-600">ReChair Admin</p>
          <h1 className="mt-3 text-4xl font-black">관리자 상담 CRM</h1>
          <p className="mt-3 text-slate-500">고객 상담, 제품 사진, 처리 상태, 담당자 메모를 한 화면에서 관리합니다.</p>
        </div>
        <button onClick={load} className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white">{loading ? '조회 중' : '새로고침'}</button>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.8fr]">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">상담 접수 CRM</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 font-black text-blue-600">{items.length}건</span>
          </div>
          <div className="mt-5 space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selected?.id === item.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex justify-between gap-3">
                  <b>{item.name}</b>
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">{item.status || '신규'}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">{item.service_type}</p>
                <p className="mt-2 font-black">{item.model || '모델 미입력'}</p>
              </button>
            ))}
          </div>
        </section>

        {selected && (
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <p className="font-black text-blue-600">{selected.service_type}</p>
            <h2 className="mt-2 text-4xl font-black">{selected.name}</h2>
            <p className="mt-2 text-slate-500">{selected.phone}</p>

            <select
              value={selected.status || '신규'}
              onChange={(e) => updateSelected({ status: e.target.value })}
              className="mt-6 w-full rounded-2xl border p-4 font-bold"
            >
              {['신규', '상담중', '견적발송', '예약완료', '방문완료', '판매완료', '종료'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">브랜드/모델</p>
                <p className="mt-2 text-xl font-black">{selected.model || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-bold text-slate-500">접수일</p>
                <p className="mt-2 text-xl font-black">{selected.created_at ? new Date(selected.created_at).toLocaleString('ko-KR') : '-'}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-bold text-slate-500">문의 내용</p>
              <p className="mt-3 whitespace-pre-wrap">{selected.message || '-'}</p>
            </div>

            <h3 className="mt-8 text-2xl font-black">첨부 사진</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              {labels.map(([key, label]) => {
                const url = selected[key];
                return (
                  <a key={key} href={url || '#'} target="_blank" className="rounded-2xl border bg-slate-50 p-3 text-center" rel="noreferrer">
                    <div className="text-sm font-black">{label}</div>
                    {url ? (
                      <img src={url} alt={label} className="mt-3 h-32 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="mt-3 flex h-32 items-center justify-center rounded-xl bg-white text-3xl">📷</div>
                    )}
                  </a>
                );
              })}
            </div>

            {Array.isArray(selected.extra_photos) && selected.extra_photos.length > 0 && (
              <>
                <h3 className="mt-8 text-xl font-black">추가 사진</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {selected.extra_photos.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`extra-${i}`} className="h-28 w-full rounded-xl object-cover" />
                    </a>
                  ))}
                </div>
              </>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <input
                defaultValue={selected.manager || ''}
                onBlur={(e) => updateSelected({ manager: e.target.value })}
                className="rounded-2xl border p-4"
                placeholder="담당자"
              />
              <input
                defaultValue={selected.quote_amount || ''}
                onBlur={(e) => updateSelected({ quote_amount: Number(e.target.value) })}
                className="rounded-2xl border p-4"
                placeholder="견적금액"
                type="number"
              />
              <input
                defaultValue={selected.memo || ''}
                onBlur={(e) => updateSelected({ memo: e.target.value })}
                className="rounded-2xl border p-4"
                placeholder="관리자 메모"
              />
            </div>

            <h3 className="mt-8 text-xl font-black">처리 타임라인</h3>
            <div className="mt-4 space-y-2">
              {(selected.timeline || []).map((log, i) => (
                <div key={`${log.at}-${i}`} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <b>{log.label}</b> <span className="text-slate-500">{new Date(log.at).toLocaleString('ko-KR')}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
