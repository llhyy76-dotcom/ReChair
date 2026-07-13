'use client';

import { useEffect, useMemo, useState } from 'react';

type Product = {
  id: string; brand: string; model_name: string; title: string; price: number;
  grade: string; status: string; year_text?: string | null; region?: string | null;
  thumbnail_url?: string | null;
};

const money = (v: number) => `${Number(v || 0).toLocaleString('ko-KR')}원`;

export default function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [brand, setBrand] = useState('');
  const [grade, setGrade] = useState('');

  useEffect(() => {
    fetch('/api/products?visible=true')
      .then(async (res) => { const json = await res.json(); if (!res.ok) throw new Error(json.error); setProducts(json.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return products.filter((p) => (!q || [p.title,p.brand,p.model_name].some(v => v.toLowerCase().includes(q))) && (!brand || p.brand === brand) && (!grade || p.grade === grade));
  }, [products, keyword, brand, grade]);

  return <section className="rc-shop-section"><div className="rc-shop-container">
    <div className="rc-shop-filter">
      <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="브랜드 또는 모델명 검색" />
      <select value={brand} onChange={e=>setBrand(e.target.value)}><option value="">전체 브랜드</option>{brands.map(v=><option key={v}>{v}</option>)}</select>
      <select value={grade} onChange={e=>setGrade(e.target.value)}><option value="">전체 등급</option><option>A급</option><option>B급</option><option>리퍼</option></select>
    </div>
    {loading ? <div className="rc-shop-empty">상품을 불러오는 중입니다.</div> : filtered.length === 0 ? <div className="rc-shop-empty">조건에 맞는 상품이 없습니다.</div> :
      <div className="rc-shop-grid">{filtered.map(p=><a className="rc-shop-card" href={`/products/${p.id}`} key={p.id}>
        <div className="rc-shop-image">{p.thumbnail_url ? <img src={p.thumbnail_url} alt={p.title}/> : <span>💺</span>}<b>{p.grade}</b></div>
        <div className="rc-shop-body"><small>{p.brand} · {p.status}</small><h2>{p.title}</h2><p>{p.model_name}</p>
          <div className="rc-shop-meta">{p.year_text&&<span>{p.year_text}</span>}{p.region&&<span>{p.region}</span>}</div>
          <strong>{money(p.price)}</strong><em>상세보기 ›</em></div>
      </a>)}</div>}
  </div></section>;
}
