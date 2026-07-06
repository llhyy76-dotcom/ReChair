'use client';

import { useEffect, useMemo, useState } from 'react';

type Consultation = {
  id: string;
  customer_name: string;
  phone: string;
  region?: string;
  service_type?: string;
  brand?: string;
  model_name?: string;
  message?: string;
  status?: string;
  assignee?: string;
  memo?: string;
  estimate_amount?: number | null;
  created_at?: string;
  photo_front_url?: string | null;
  photo_side_url?: string | null;
  photo_label_url?: string | null;
  photo_back_url?: string | null;
};

const photoLabels = [
  ['photo_front_url', '앞면'],
  ['photo_side_url', '옆면'],
  ['photo_label_url', '라벨'],
  ['photo_back_url', '뒷면'],
] as const;

export default function AdminConsultations() {
  const [items, setItems] = useState<Consultation[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId]);

  async function loadData() {
    const response = await fetch('/api/consultations', { cache: 'no-store' });
    const result = await response.json();
    const data = result.data ?? [];
    setItems(data);
    if (!selectedId && data[0]) setSelectedId(data[0].id);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateSelected(formData: FormData) {
    if (!selected) return;
    setSaving(true);
    const payload = {
      status: formData.get('status'),
      assignee: formData.get('assignee'),
      memo: formData.get('memo'),
      estimate_amount: formData.get('estimate_amount'),
    };
    await fetch(`/api/consultations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await loadData();
    setSaving(false);
  }

  return (
    <div className="admin-crm">
      <aside className="consult-list">
        <h2>상담 목록</h2>
        {items.length === 0 && <p className="empty">아직 접수된 상담이 없습니다.</p>}
        {items.map((item) => (
          <button
            className={`consult-item ${selected?.id === item.id ? 'active' : ''}`}
            key={item.id}
            onClick={() => setSelectedId(item.id)}
          >
            <strong>{item.customer_name || '이름 없음'}</strong>
            <span>{item.phone}</span>
            <small>{item.service_type || '상담'} · {item.status || '신규'}</small>
          </button>
        ))}
      </aside>

      <section className="consult-detail">
        {!selected ? (
          <div className="empty-panel">상담을 선택해 주세요.</div>
        ) : (
          <>
            <div className="detail-head">
              <div>
                <p className="eyebrow">CONSULTATION DETAIL</p>
                <h1>{selected.customer_name}</h1>
                <p>{selected.phone} · {selected.region || '지역 미입력'}</p>
              </div>
              <span className="status-badge">{selected.status || '신규'}</span>
            </div>

            <div className="detail-grid">
              <div><b>서비스</b><span>{selected.service_type || '-'}</span></div>
              <div><b>브랜드</b><span>{selected.brand || '-'}</span></div>
              <div><b>모델명</b><span>{selected.model_name || '-'}</span></div>
              <div><b>접수일</b><span>{selected.created_at ? new Date(selected.created_at).toLocaleString('ko-KR') : '-'}</span></div>
            </div>

            <div className="message-box">{selected.message || '문의내용 없음'}</div>

            <div className="admin-photo-grid">
              {photoLabels.map(([key, label]) => {
                const url = selected[key];
                return (
                  <button className="admin-photo-card" key={key} onClick={() => url && setLightbox(url)} disabled={!url}>
                    {url ? <img src={url} alt={label} /> : <span>📷</span>}
                    <b>{label}</b>
                  </button>
                );
              })}
            </div>

            <form action={updateSelected} className="admin-edit-form">
              <label>
                <span>상태</span>
                <select name="status" defaultValue={selected.status || '신규'}>
                  <option>신규</option>
                  <option>상담중</option>
                  <option>견적발송</option>
                  <option>예약완료</option>
                  <option>방문완료</option>
                  <option>판매완료</option>
                  <option>종료</option>
                </select>
              </label>
              <label>
                <span>담당자</span>
                <input name="assignee" defaultValue={selected.assignee || ''} />
              </label>
              <label>
                <span>견적금액</span>
                <input name="estimate_amount" type="number" defaultValue={selected.estimate_amount ?? ''} />
              </label>
              <label className="full">
                <span>관리자 메모</span>
                <textarea name="memo" defaultValue={selected.memo || ''} />
              </label>
              <button className="primary-btn" disabled={saving}>{saving ? '저장 중...' : '상담정보 저장'}</button>
            </form>
          </>
        )}
      </section>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="상담 사진 확대" />
        </div>
      )}
    </div>
  );
}
