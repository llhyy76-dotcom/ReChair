'use client';

import { useEffect, useMemo, useState } from 'react';

type Consultation = {
  id: string;
  name?: string | null;
  phone?: string | null;
  service_type?: string | null;
  model?: string | null;
  message?: string | null;
  status?: string | null;
  manager?: string | null;
  memo?: string | null;
  quote_amount?: number | null;
  created_at?: string | null;
  photo_front?: string | null;
  photo_side?: string | null;
  photo_label?: string | null;
  photo_back?: string | null;
};

const photoLabels = [
  ['photo_front', '앞면'],
  ['photo_side', '옆면'],
  ['photo_label', '라벨'],
  ['photo_back', '뒷면'],
] as const;

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatMoney(value?: number | null) {
  if (!value) return '미입력';
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

export default function AdminConsultations() {
  const [items, setItems] = useState<Consultation[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const selected = useMemo(() => {
    return items.find((item) => item.id === selectedId) || items[0];
  }, [items, selectedId]);

  async function loadData() {
    const response = await fetch('/api/consultations', { cache: 'no-store' });
    const result = await response.json();
    const data: Consultation[] = result.data ?? [];
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
      manager: formData.get('manager'),
      memo: formData.get('memo'),
      quote_amount: formData.get('quote_amount'),
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
        <div className="admin-panel-title">
          <h2>상담 목록</h2>
          <span>{items.length}건</span>
        </div>

        {items.length === 0 && <p className="empty">아직 접수된 상담이 없습니다.</p>}

        <div className="consult-list-items">
          {items.map((item) => (
            <button
              className={`consult-item ${selected?.id === item.id ? 'active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
            >
              <div className="consult-item-top">
                <strong>{item.name || '이름 없음'}</strong>
                <em>{item.status || '신규'}</em>
              </div>
              <span>{item.phone || '연락처 없음'}</span>
              <small>{item.service_type || '상담'} · {item.model || '모델 미입력'}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="consult-detail">
        {!selected ? (
          <div className="empty-panel">상담을 선택해 주세요.</div>
        ) : (
          <>
            <div className="detail-head">
              <div>
                <p className="eyebrow">CONSULTATION DETAIL</p>
                <h1>{selected.name || '이름 없음'}</h1>
                <p>{selected.phone || '연락처 없음'}</p>
              </div>
              <span className="status-badge">{selected.status || '신규'}</span>
            </div>

            <div className="detail-grid">
              <div><b>서비스</b><span>{selected.service_type || '-'}</span></div>
              <div><b>모델</b><span>{selected.model || '-'}</span></div>
              <div><b>접수일</b><span>{formatDate(selected.created_at)}</span></div>
              <div><b>견적금액</b><span>{formatMoney(selected.quote_amount)}</span></div>
            </div>

            <div className="message-box">
              <b>문의 내용</b>
              <p>{selected.message || '문의내용 없음'}</p>
            </div>

            <div className="admin-photo-block">
              <h3>첨부 사진</h3>
              <div className="admin-photo-grid">
                {photoLabels.map(([key, label]) => {
                  const url = selected[key];
                  return (
                    <button
                      className="admin-photo-card"
                      key={key}
                      type="button"
                      onClick={() => url && setLightbox(url)}
                      disabled={!url}
                    >
                      {url ? <img src={url} alt={label} /> : <span>📷</span>}
                      <b>{label}</b>
                    </button>
                  );
                })}
              </div>
            </div>

            <form action={updateSelected} className="admin-edit-form">
              <label>
                <span>상태</span>
                <select name="status" defaultValue={selected.status || '신규'} key={`status-${selected.id}`}>
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
                <input name="manager" defaultValue={selected.manager || ''} key={`manager-${selected.id}`} />
              </label>

              <label>
                <span>견적금액</span>
                <input name="quote_amount" type="number" defaultValue={selected.quote_amount ?? ''} key={`quote-${selected.id}`} />
              </label>

              <label className="full">
                <span>관리자 메모</span>
                <textarea name="memo" defaultValue={selected.memo || ''} key={`memo-${selected.id}`} />
              </label>

              <button className="primary-btn" disabled={saving} type="submit">
                {saving ? '저장 중...' : '상담정보 저장'}
              </button>
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
