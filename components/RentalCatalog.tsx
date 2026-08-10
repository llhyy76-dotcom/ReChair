'use client';

import { useEffect, useMemo, useState } from 'react';

type RentalType = 'personal' | 'commercial';

type RentalProduct = {
  id: string;
  title?: string | null;
  name?: string | null;
  brand?: string | null;
  model_name?: string | null;
  model?: string | null;
  status: string;
  thumbnail_url?: string | null;
  image_url?: string | null;
  monthly_fee?: number | null;
  deposit_amount?: number | null;
  setup_fee?: number | null;
  contract_months?: number | null;
  installation_regions?: string | null;
  rental_notes?: string | null;
  rental_type?: RentalType | null;
};

type Filter = 'all' | RentalType;

function money(value?: number | null) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function typeLabel(type?: RentalType | null) {
  return type === 'commercial' ? '영업용 · 코인형' : '개인용';
}

export default function RentalCatalog() {
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    fetch('/api/products?visible=true&listing_type=rental', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || '렌탈 상품을 불러오지 못했습니다.');
        if (active) setProducts(Array.isArray(result.data) ? result.data : []);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '렌탈 상품 조회 오류');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleProducts = useMemo(
    () => filter === 'all' ? products : products.filter((product) => product.rental_type === filter),
    [filter, products]
  );

  return (
    <section className="rental-catalog" aria-labelledby="rental-catalog-title">
      <div className="rental-catalog-head">
        <div>
          <p>RENTAL PRODUCTS</p>
          <h2 id="rental-catalog-title">렌탈 가능 상품</h2>
          <span>상품별 월 렌탈료와 계약 조건을 비교하고 바로 상담을 신청할 수 있습니다.</span>
        </div>

        <div className="rental-filters" aria-label="렌탈 상품 구분">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>전체</button>
          <button type="button" className={filter === 'personal' ? 'active' : ''} onClick={() => setFilter('personal')}>개인용</button>
          <button type="button" className={filter === 'commercial' ? 'active' : ''} onClick={() => setFilter('commercial')}>영업용</button>
        </div>
      </div>

      {loading && <div className="rental-catalog-state">렌탈 상품을 불러오는 중입니다.</div>}
      {error && <div className="rental-catalog-state error">{error}</div>}

      {!loading && !error && visibleProducts.length === 0 && (
        <div className="rental-catalog-empty">
          <span>💺</span>
          <h3>현재 등록된 렌탈 상품을 준비하고 있습니다.</h3>
          <p>원하는 사용 목적과 설치지역을 남겨주시면 조건에 맞는 상품을 안내해 드립니다.</p>
          <div>
            <a href="/consult?service=rental-personal">개인용 렌탈 상담</a>
            <a href="/consult?service=rental-commercial">영업용 렌탈 상담</a>
          </div>
        </div>
      )}

      {visibleProducts.length > 0 && (
        <div className="rental-product-grid">
          {visibleProducts.map((product) => {
            const service = product.rental_type === 'commercial' ? 'rental-commercial' : 'rental-personal';
            const hasMonthlyFee = Number(product.monthly_fee || 0) > 0;
            const modelName = product.model_name || product.model || '';
            const productTitle = product.title || product.name || [product.brand, modelName].filter(Boolean).join(' ') || '렌탈 안마의자';
            const productIdentity = [product.brand, modelName].filter(Boolean).join(' · ') || typeLabel(product.rental_type);
            const thumbnail = product.thumbnail_url || product.image_url;

            return (
              <article className="rental-product-card" key={product.id}>
                <div className="rental-product-image">
                  {thumbnail ? (
                    <img src={thumbnail} alt={productTitle} />
                  ) : (
                    <span>💺</span>
                  )}
                  <b>{typeLabel(product.rental_type)}</b>
                </div>

                <div className="rental-product-body">
                  <div className="rental-product-identity">
                    <small>{productIdentity}</small>
                    <h3>{productTitle}</h3>
                  </div>
                  <div className="rental-product-price">
                    {hasMonthlyFee ? <><strong>{money(product.monthly_fee)}원</strong><span>/월</span></> : <strong>렌탈료 상담</strong>}
                  </div>

                  <dl>
                    <div><dt>계약기간</dt><dd>{product.contract_months ? `${product.contract_months}개월` : '상담 후 결정'}</dd></div>
                    <div><dt>보증금</dt><dd>{product.deposit_amount ? `${money(product.deposit_amount)}원` : '없음'}</dd></div>
                    <div><dt>설치비</dt><dd>{product.setup_fee ? `${money(product.setup_fee)}원` : '상담 확인'}</dd></div>
                    <div><dt>설치지역</dt><dd>{product.installation_regions || '상담 후 확인'}</dd></div>
                  </dl>

                  {product.rental_notes && <p>{product.rental_notes}</p>}

                  <a href={`/consult?service=${service}&product=${product.id}`}>이 상품 렌탈 상담</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
