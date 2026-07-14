'use client';

import { useEffect, useMemo, useState } from 'react';

type DashboardData = {
  summary: {
    total_consultations: number;
    new_consultations: number;
    in_progress_consultations: number;
    completed_consultations: number;
    product_consultations: number;
    total_products: number;
    visible_products: number;
    sold_out_products: number;
    total_estimate_amount: number;
  };
  consultation_status: Array<{ status: string; count: number }>;
  service_counts: Array<{ service_type: string; count: number }>;
  recent_consultations: Array<{
    id: string;
    customer_name: string;
    phone: string;
    service_type?: string | null;
    product_title?: string | null;
    status?: string | null;
    created_at?: string | null;
  }>;
  recent_products: Array<{
    id: string;
    title: string;
    brand: string;
    model_name: string;
    price: number;
    status: string;
    is_visible: boolean;
    created_at?: string | null;
    thumbnail_url?: string | null;
  }>;
};

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatMoney(value: number) {
  return `${formatNumber(value)}원`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/dashboard', { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || '대시보드 정보를 불러오지 못했습니다.');
      }

      setData(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '대시보드 조회 오류');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const maxServiceCount = useMemo(() => {
    if (!data?.service_counts.length) return 1;
    return Math.max(...data.service_counts.map((item) => item.count), 1);
  }, [data]);

  if (loading) {
    return <div className="rc-dashboard-loading">대시보드를 불러오는 중입니다.</div>;
  }

  if (error || !data) {
    return (
      <div className="rc-dashboard-error">
        <strong>대시보드를 불러오지 못했습니다.</strong>
        <p>{error}</p>
        <button type="button" onClick={loadDashboard}>다시 불러오기</button>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="rc-dashboard">
      <div className="rc-dashboard-head">
        <div>
          <p>RECHAIR ADMIN</p>
          <h1>운영 대시보드</h1>
          <span>상담, 상품, 견적 현황을 한 화면에서 확인합니다.</span>
        </div>

        <button type="button" onClick={loadDashboard}>
          새로고침
        </button>
      </div>

      <section className="rc-dashboard-kpis">
        <article>
          <small>전체 상담</small>
          <strong>{formatNumber(summary.total_consultations)}</strong>
          <span>누적 접수</span>
        </article>

        <article className="accent">
          <small>신규 상담</small>
          <strong>{formatNumber(summary.new_consultations)}</strong>
          <span>확인 필요</span>
        </article>

        <article>
          <small>진행 중</small>
          <strong>{formatNumber(summary.in_progress_consultations)}</strong>
          <span>상담·견적·예약</span>
        </article>

        <article>
          <small>완료 상담</small>
          <strong>{formatNumber(summary.completed_consultations)}</strong>
          <span>방문·판매·종료</span>
        </article>

        <article>
          <small>상품 문의</small>
          <strong>{formatNumber(summary.product_consultations)}</strong>
          <span>구매상담 연동</span>
        </article>

        <article>
          <small>판매상품</small>
          <strong>{formatNumber(summary.visible_products)}</strong>
          <span>전체 {formatNumber(summary.total_products)}개</span>
        </article>

        <article>
          <small>판매완료</small>
          <strong>{formatNumber(summary.sold_out_products)}</strong>
          <span>상품 상태 기준</span>
        </article>

        <article className="money">
          <small>등록 견적금액</small>
          <strong>{formatMoney(summary.total_estimate_amount)}</strong>
          <span>상담 견적 합계</span>
        </article>
      </section>

      <section className="rc-dashboard-grid">
        <article className="rc-dashboard-panel">
          <div className="rc-panel-head">
            <div>
              <p>CONSULTATION STATUS</p>
              <h2>상담 처리상태</h2>
            </div>
            <a href="/admin">상담 CRM 열기 ›</a>
          </div>

          <div className="rc-status-grid">
            {data.consultation_status.map((item) => (
              <div key={item.status}>
                <span>{item.status}</span>
                <strong>{formatNumber(item.count)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="rc-dashboard-panel">
          <div className="rc-panel-head">
            <div>
              <p>SERVICE ANALYSIS</p>
              <h2>서비스별 접수</h2>
            </div>
          </div>

          <div className="rc-service-bars">
            {data.service_counts.map((item) => (
              <div key={item.service_type}>
                <div>
                  <span>{item.service_type}</span>
                  <strong>{formatNumber(item.count)}</strong>
                </div>
                <i>
                  <b style={{ width: `${(item.count / maxServiceCount) * 100}%` }} />
                </i>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rc-dashboard-grid">
        <article className="rc-dashboard-panel">
          <div className="rc-panel-head">
            <div>
              <p>RECENT CONSULTATIONS</p>
              <h2>최근 상담</h2>
            </div>
            <a href="/admin">전체 상담 보기 ›</a>
          </div>

          <div className="rc-dashboard-list">
            {data.recent_consultations.length === 0 ? (
              <p className="empty">등록된 상담이 없습니다.</p>
            ) : (
              data.recent_consultations.map((item) => (
                <a href="/admin" key={item.id}>
                  <div>
                    <strong>{item.customer_name || '이름 없음'}</strong>
                    <span>{item.phone}</span>
                    {item.product_title && <em>{item.product_title}</em>}
                  </div>
                  <div>
                    <b>{item.service_type || '상담'}</b>
                    <small>{item.status || '신규'}</small>
                    <time>{formatDate(item.created_at)}</time>
                  </div>
                </a>
              ))
            )}
          </div>
        </article>

        <article className="rc-dashboard-panel">
          <div className="rc-panel-head">
            <div>
              <p>RECENT PRODUCTS</p>
              <h2>최근 등록상품</h2>
            </div>
            <a href="/admin/products">상품관리 열기 ›</a>
          </div>

          <div className="rc-dashboard-products">
            {data.recent_products.length === 0 ? (
              <p className="empty">등록된 상품이 없습니다.</p>
            ) : (
              data.recent_products.map((product) => (
                <a href={`/products/${product.id}`} target="_blank" key={product.id}>
                  <div className="rc-dashboard-product-image">
                    {product.thumbnail_url ? (
                      <img src={product.thumbnail_url} alt={product.title} />
                    ) : (
                      <span>💺</span>
                    )}
                  </div>
                  <div>
                    <strong>{product.title}</strong>
                    <span>{product.brand} · {product.model_name}</span>
                    <b>{formatMoney(product.price)}</b>
                  </div>
                  <small>{product.status}</small>
                </a>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="rc-dashboard-shortcuts">
        <a href="/admin">상담 CRM</a>
        <a href="/admin/products">상품 등록·수정</a>
        <a href="/products" target="_blank">고객 상품페이지</a>
        <a href="/consult" target="_blank">상담 신청페이지</a>
      </section>
    </div>
  );
}
