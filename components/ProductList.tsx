const products = [
  {name:'코지마 CMC-A100', desc:'외관 양호 · 기본 작동 점검', grade:'A급', price:'상담가'},
  {name:'바디프랜드 팬텀', desc:'프리미엄급 중고상품, 이전설치 상담 가능', grade:'B+급', price:'상담가'},
  {name:'세라젬 V7', desc:'상태 확인 후 판매 가능 여부 안내', grade:'A+급', price:'상담문의'},
]
export default function ProductList(){
  return <section id="products" className="section market"><div className="section-inner"><p className="section-kicker">ReMarket</p><h2 className="section-title">판매 중인 중고상품</h2><div className="product-grid">{products.map(p=><article className="product-card" key={p.name}><div className="product-img">🛋️</div><div className="product-body"><span className="grade">{p.grade}</span><h3>{p.name}</h3><p>{p.desc}</p><div className="price-row"><div className="price">{p.price}</div><a className="small-dark" href="#consult">상담</a></div></div></article>)}</div></div></section>
}
