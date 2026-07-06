import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
  photo_front?: string | null;
  photo_side?: string | null;
  photo_label?: string | null;
  photo_back?: string | null;
  created_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function money(value?: number | null) {
  if (!value) return '';
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

export default async function AdminPage() {
  let consultations: Consultation[] = [];

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('consultations')
      .select('*')
      .order('created_at', { ascending: false });

    consultations = data ?? [];
  }

  const selected = consultations[0];

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <p className="eyebrow">RECHAIR ADMIN</p>
        <div className="admin-hero-row">
          <div>
            <h1>관리자 상담 CRM</h1>
            <p>고객 상담, 제품 사진, 처리 상태, 담당자 메모를 한 화면에서 관리합니다.</p>
          </div>
          <a className="admin-refresh" href="/admin">새로고침</a>
        </div>
      </section>

      <section className="admin-layout">
        <aside className="admin-list-panel">
          <div className="panel-title">
            <h2>상담 목록</h2>
            <span>{consultations.length}건</span>
          </div>

          {consultations.length === 0 ? (
            <div className="empty-box">아직 접수된 상담이 없습니다.</div>
          ) : (
            <div className="consultation-list">
              {consultations.map((item, index) => (
                <a
                  href={`#consultation-${item.id}`}
                  className={`consultation-card ${index === 0 ? 'active' : ''}`}
                  key={item.id}
                >
                  <div className="consultation-card-top">
                    <strong>{item.name || '이름 없음'}</strong>
                    <span>{item.status || '신규'}</span>
                  </div>
                  <p>{item.phone || '연락처 없음'}</p>
                  <small>{item.service_type || '상담'} · {item.model || '모델 미입력'}</small>
                </a>
              ))}
            </div>
          )}
        </aside>

        <section className="admin-detail-panel">
          {!selected ? (
            <div className="empty-detail">상담을 선택해 주세요.</div>
          ) : (
            <article className="detail-card" id={`consultation-${selected.id}`}>
              <div className="detail-head">
                <div>
                  <p className="service-label">{selected.service_type || '상담'}</p>
                  <h2>{selected.name || '이름 없음'}</h2>
                  <p>{selected.phone || '연락처 없음'}</p>
                </div>
                <span className="status-pill">{selected.status || '신규'}</span>
              </div>

              <div className="detail-grid">
                <div className="info-box">
                  <span>모델</span>
                  <strong>{selected.model || '모델 미입력'}</strong>
                </div>
                <div className="info-box">
                  <span>접수일</span>
                  <strong>{formatDate(selected.created_at)}</strong>
                </div>
                <div className="info-box">
                  <span>담당자</span>
                  <strong>{selected.manager || '미배정'}</strong>
                </div>
                <div className="info-box">
                  <span>견적금액</span>
                  <strong>{money(selected.quote_amount) || '미입력'}</strong>
                </div>
              </div>

              <div className="message-box">
                <span>문의 내용</span>
                <p>{selected.message || '문의내용 없음'}</p>
              </div>

              <div className="photo-section">
                <h3>첨부 사진</h3>
                <div className="admin-photo-grid">
                  {[
                    ['앞면', selected.photo_front],
                    ['옆면', selected.photo_side],
                    ['라벨', selected.photo_label],
                    ['뒷면', selected.photo_back],
                  ].map(([label, url]) => (
                    <div className="admin-photo-card" key={label}>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`${label} 사진`} />
                        </a>
                      ) : (
                        <div className="no-photo">📷</div>
                      )}
                      <strong>{label}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="memo-box">
                <span>관리자 메모</span>
                <p>{selected.memo || '아직 메모가 없습니다.'}</p>
              </div>
            </article>
          )}
        </section>
      </section>
    </main>
  );
}
