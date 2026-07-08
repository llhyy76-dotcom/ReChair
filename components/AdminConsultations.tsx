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

const statusOptions = ['전체', '신규', '상담중', '견적발송', '예약완료', '방문완료', '판매완료', '종료'];

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatMoney(value?: number | null) {
  if (!value) return '미입력';
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function normalize(value?: string | null) {
  return String(value ?? '').toLowerCase().replace(/\s/g, '');
}

export default function AdminConsultations() {
  const [items, setItems] = useState<Consultation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');

  const filteredItems = useMemo(() => {
    const keyword = normalize(query);

    return items.filter((item) => {
      const statusMatched = statusFilter === '전체' || (item.status || '신규') === statusFilter;

      const keywordMatched =
        !keyword ||
        normalize(item.name).includes(keyword) ||
        normalize(item.phone).includes(keyword) ||
        normalize(item.model).includes(keyword) ||
        normalize(item.service_type).includes(keyword) ||
        normalize(item.message).includes(keyword) ||
        normalize(item.manager).includes(keyword);

      return statusMatched && keywordMatched;
    });
  }, [items, query, statusFilter]);

  const selected = useMemo(() => {
    if (selectedId) {
      const current = items.find((item) => item.id === selectedId);
      if (current) return current;
    }
    return filteredItems[0] || items[0];
  }, [items, filteredItems, selectedId]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      newCount: items.filter((item) => (item.status || '신규') === '신규').length,
      activeCount: items.filter((item) => !['판매완료', '종료'].includes(item.status || '신규')).length,
      doneCount: items.filter((item) => ['판매완료', '종료'].includes(item.status || '')).length,
    };
  }, [items]);

  async function loadData(keepSelectedId?: string) {
    const response = await fetch('/api/consultations', { cache: 'no-store' });
    const result = await response.json();
    const data: Consultation[] = result.data ?? [];
    setItems(data);

    const nextSelectedId = keepSelectedId || selectedId;
    if (nextSelectedId && data.some((item) => item.id === nextSelectedId)) {
      setSelectedId(nextSelectedId);
    } else if (data[0]) {
      setSelectedId(data[0].id);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId && filteredItems[0]) setSelectedId(filteredItems[0].id);
    if (selectedId && filteredItems.length > 0 && !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  async function updateSelected(formData: FormData) {
    if (!selected) return;

    setSaving(true);
    setSaveMessage('');

    const rawQuote = String(formData.get('quote_amount') ?? '').trim();

    const payload = {
      status: String(formData.get('status') ?? '신규'),
      manager: String(formData.get('manager') ?? '').trim(),
      memo: String(formData.get('memo') ?? '').trim(),
      quote_amount: rawQuote === '' ? null : Number(rawQuote),
    };

    const response = await fetch(`/api/consultations/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setSaveMessage(result.error || '저장 중 오류가 발생했습니다.');
      setSaving(false);
      return;
    }

    setItems((prev) =>
      prev.map((item) => (item.id === selected.id ? { ...item, ...result.data } : item))
    );

    await loadData(selected.id);
    setSaveMessage('저장되었습니다.');
    setSaving(false);
  }

  return (
    <section className="admin-crm-final">
      <aside className="admin-left">
        <div className="admin-left-head">
          <h2>상담 목록</h2>
          <span>{filteredItems.length}건</span>
        </div>

        <div className="admin-summary-row">
          <div><b>{counts.total}</b><span>전체</span></div>
          <div><b>{counts.newCount}</b><span>신규</span></div>
          <div><b>{counts.activeCount}</b><span>진행</span></div>
          <div><b>{counts.doneCount}</b><span>완료</span></div>
        </div>

        <div className="admin-filter-box">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, 연락처, 모델명 검색"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="admin-list-scroll">
          {filteredItems.length === 0 && <p className="admin-empty">검색 결과가 없습니다.</p>}

          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-list-card ${selected?.id === item.id ? 'is-active' : ''}`}
              onClick={() => {
                setSelectedId(item.id);
                setSaveMessage('');
              }}
            >
              <div>
                <strong>{item.name || '이름 없음'}</strong>
                <small>{item.phone || '연락처 없음'}</small>
                <b>{item.service_type || '상담'} · {item.model || '모델 미입력'}</b>
              </div>
              <em className={`status-chip status-${item.status || '신규'}`}>{item.status || '신규'}</em>
            </button>
          ))}
        </div>
      </aside>

      <article className="admin-right">
        {!selected ? (
          <div className="admin-empty">상담을 선택해 주세요.</div>
        ) : (
          <>
            <div className="admin-detail-top">
              <div>
                <p>CONSULTATION DETAIL</p>
                <h2>{selected.name || '이름 없음'}</h2>
                <span>{selected.phone || '연락처 없음'}</span>
              </div>
              <em className={`status-chip status-${selected.status || '신규'}`}>{selected.status || '신규'}</em>
            </div>

            <div className="admin-info-grid">
              <div><span>서비스</span><strong>{selected.service_type || '-'}</strong></div>
              <div><span>모델</span><strong>{selected.model || '-'}</strong></div>
              <div><span>접수일</span><strong>{formatDate(selected.created_at)}</strong></div>
              <div><span>견적금액</span><strong>{formatMoney(selected.quote_amount)}</strong></div>
              <div><span>담당자</span><strong>{selected.manager || '미배정'}</strong></div>
              <div><span>상태</span><strong>{selected.status || '신규'}</strong></div>
            </div>

            <div className="admin-message">
              <span>문의 내용</span>
              <p>{selected.message || '문의내용 없음'}</p>
            </div>

            <div className="admin-message">
              <span>관리자 메모</span>
              <p>{selected.memo || '아직 메모가 없습니다.'}</p>
            </div>

            <div className="admin-photos">
              <h3>첨부 사진</h3>
              <div className="admin-photo-list">
                {photoLabels.map(([key, label]) => {
                  const url = selected[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      className="admin-photo"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (url) setLightbox(url);
                      }}
                      disabled={!url}
                      title={url ? `${label} 확대보기` : `${label} 사진 없음`}
                    >
                      {url ? (
                        <>
                          <img src={url} alt={label} draggable={false} />
                          <span className="admin-photo-zoom">확대보기</span>
                        </>
                      ) : (
                        <span>📷</span>
                      )}
                      <b>{label}</b>
                    </button>
                  );
                })}
              </div>
            </div>

            <form action={updateSelected} className="admin-form">
              <label>
                <span>상태</span>
                <select name="status" defaultValue={selected.status || '신규'} key={`status-${selected.id}`}>
                  {statusOptions.filter((status) => status !== '전체').map((status) => (
                    <option key={status}>{status}</option>
                  ))}
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

              <label className="wide">
                <span>관리자 메모</span>
                <textarea name="memo" defaultValue={selected.memo || ''} key={`memo-${selected.id}`} />
              </label>

              {saveMessage && <p className="admin-save-message">{saveMessage}</p>}

              <button type="submit" disabled={saving}>
                {saving ? '저장 중...' : '상담정보 저장'}
              </button>
            </form>
          </>
        )}
      </article>

      {lightbox && (
        <div
          className="admin-lightbox"
          role="button"
          tabIndex={0}
          onClick={() => setLightbox(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter') setLightbox(null);
          }}
        >
          <button className="admin-lightbox-close" type="button" onClick={() => setLightbox(null)}>
            닫기
          </button>
          <img src={lightbox} alt="상담 사진 확대" draggable={false} />
        </div>
      )}
    </section>
  );
}
