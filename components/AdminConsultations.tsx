'use client';

import { useEffect, useMemo, useState } from 'react';

type Consultation = {
  id?: string;
  created_at?: string;
  name: string;
  phone: string;
  service: string;
  model: string;
  message: string;
  photos?: string[];
  status?: string;
  manager?: string;
  memo?: string;
};

const statusOptions = ['신규', '확인중', '견적완료', '예약완료', '완료', '보류'];

function getPhotoLabel(photo: string) {
  if (photo.startsWith('frontPhoto')) return '앞면';
  if (photo.startsWith('sidePhoto')) return '옆면';
  if (photo.startsWith('labelPhoto')) return '제품라벨';
  if (photo.startsWith('backPhoto')) return '뒷면';
  return '사진';
}

export default function AdminConsultations() {
  const [items, setItems] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/consultations', { cache: 'no-store' });
        const json = await res.json();
        setItems(json.consultations || []);
        setSelectedId(json.consultations?.[0]?.id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId]);

  async function updateLocalAndServer(id: string | undefined, patch: Partial<Consultation>) {
    if (!id) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    await fetch(`/api/consultations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).catch(() => null);
  }

  if (loading) {
    return <div className="rounded-3xl border bg-white p-8 text-slate-500">상담 데이터를 불러오는 중입니다.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">상담 접수 CRM</h2>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-600">{items.length}건</span>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id || item.phone}
              onClick={() => setSelectedId(item.id)}
              className={`w-full rounded-2xl border p-4 text-left transition hover:border-blue-400 ${selected?.id === item.id ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <strong>{item.name || '이름 없음'}</strong>
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{item.status || '신규'}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{item.service}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{item.model}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        {!selected ? (
          <div className="py-20 text-center text-slate-500">상담 접수가 없습니다.</div>
        ) : (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
              <div>
                <p className="text-sm font-bold text-blue-600">{selected.service}</p>
                <h2 className="mt-1 text-3xl font-black">{selected.name}</h2>
                <p className="mt-2 text-slate-500">{selected.phone}</p>
              </div>
              <select
                value={selected.status || '신규'}
                onChange={(e) => updateLocalAndServer(selected.id, { status: e.target.value })}
                className="rounded-xl border px-4 py-3 font-bold"
              >
                {statusOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-500">브랜드/모델</p>
                <p className="mt-2 text-lg font-black">{selected.model || '-'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-500">접수일</p>
                <p className="mt-2 text-lg font-black">{selected.created_at ? new Date(selected.created_at).toLocaleString('ko-KR') : '-'}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">문의 내용</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-800">{selected.message || '-'}</p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-black">첨부 사진</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(selected.photos || []).length > 0 ? (
                  selected.photos?.map((photo) => (
                    <div key={photo} className="rounded-2xl border bg-slate-50 p-4">
                      <div className="flex aspect-square items-center justify-center rounded-xl bg-white text-4xl">📷</div>
                      <p className="mt-3 text-sm font-black">{getPhotoLabel(photo)}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{photo.split(':')[1] || photo}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">첨부 사진이 없습니다.</p>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-600">담당자</span>
                <input
                  defaultValue={selected.manager || ''}
                  onBlur={(e) => updateLocalAndServer(selected.id, { manager: e.target.value })}
                  className="mt-2 w-full rounded-xl border px-4 py-3"
                  placeholder="예: 임경선"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-600">관리 메모</span>
                <input
                  defaultValue={selected.memo || ''}
                  onBlur={(e) => updateLocalAndServer(selected.id, { memo: e.target.value })}
                  className="mt-2 w-full rounded-xl border px-4 py-3"
                  placeholder="상담 메모 입력"
                />
              </label>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
