const products = [
  { id: 1, grade: 'A급', area: '경기 고양', name: '코지마 CMC-A100', desc: '외관 양호 · 기본 작동 점검', price: '상담가' },
  { id: 2, grade: 'B+급', area: '서울', name: '바디프랜드 팬텀', desc: '프리미엄급 중고상품', price: '상담가' },
  { id: 3, grade: 'A+급', area: '전국', name: '세라젬 V7', desc: '상태 확인 후 판매 가능', price: '상담문의' },
];

export default function ProductList() {
  return (
    <section className="section market-section">
      <div className="market-header">
        <div>
          <span>ReMarket</span>
          <h2>판매 중인 중고상품</h2>
        </div>
        <a href="/#consult">상품 문의하기 →</a>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <article className="product-card" key={product.id}>
            <div className="product-image"><span>🛋️</span></div>
            <div className="product-body">
              <div className="product-badge">{product.grade}</div>
              <h3>{product.name}</h3>
              <p>{product.desc}</p>
              <div className="product-meta">{product.area}</div>
              <div className="product-bottom">
                <strong>{product.price}</strong>
                <a href={`/#consult?product=${product.id}`}>상담</a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
