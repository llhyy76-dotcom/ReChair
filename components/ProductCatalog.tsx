'use client';

import { useEffect, useMemo, useState } from 'react';

type Product = {
  id: string; brand: string; model_name: string; title: string; price: number;
  grade: string; status: string; year_text?: string | null; region?: string | null;
  thumbnail_url?: string | null; is_featured?: boolean;
};

const money = (v:number) => `${Number(v || 0).toLocaleString('ko-KR')}원`;

export default function ProductCatalog() {
  const [products,setProducts] = useState<Product[]>([]);
  const [loading,setLoading] = useState(true);
  const [keyword,setKeyword] = useState('');
  const [brand,setBrand] = useState('');
  const [grade,setGrade] = useState('');
  const [sort,setSort] = useState('featured');

  useEffect(() => {
    fetch('/api/products?visible=true')
      .then(async r => { const j = await r.json(); if(!r.ok) throw new Error(j?.error); setProducts(j.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const arr = products.filter(p =>
      (!q || p.title.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.model_name.toLowerCase().includes(q)) &&
      (!brand || p.brand === brand) &&
      (!grade || p.grade === grade)
    );
    return [...arr].sort((a,b) => {
      if(sort === 'price-low') return Number(a.price)-Number(b.price);
      if(sort === 'price-high') return Number(b.price)-Number(a.price);
      if(sort === 'name') return a.title.localeCompare(b.title,'ko');
      return Number(Boolean(b.is_featured))-Number(Boolean(a.is_featured));
    });
  }, [products,keyword,brand,grade,sort]);

  return <section className="rc-store-section"><div className="rc-store-container">
    <div className="rc-store-toolbar">
      <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="브랜드 또는 모델명 검색"/>
      <select value={brand} onChange={e=>setBrand(e.target.value)}><option value="">전체 브랜드</option>{brands.map(b=><option key={b}>{b}</option>)}</select>
      <select value={grade} onChange={e=>setGrade(e.target.value)}><option value="">전체 등급</option><option>A급</option><option>B급</option><option>리퍼</option></select>
      <select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">추천순</option><option value="price-low">낮은 가격순</option><option value="price-high">높은 가격순</option><option value="name">상품명순</option></select>
    </div>
    <div className="rc-store-result-head"><strong>{filtered.length}개 상품</strong><span>상품 상태와 가격은 상담 시점에 따라 변경될 수 있습니다.</span></div>
    {loading ? <div className="rc-store-empty">상품을 불러오는 중입니다.</div> :
    filtered.length === 0 ? <div className="rc-store-empty">조건에 맞는 상품이 없습니다.</div> :
    <div className="rc-store-grid">{filtered.map(p=>
      <a className="rc-store-card" href={`/products/${p.id}`} key={p.id}>
        <div className="rc-store-image">
          {p.thumbnail_url ? <img src={p.thumbnail_url} alt={p.title}/> : <span>💺</span>}
          {p.is_featured && <i>추천</i>}<b>{p.grade}</b>
        </div>
        <div className="rc-store-body"><small>{p.brand} · {p.status}</small><h2>{p.title}</h2><p>{p.model_name}</p>
          <div className="rc-store-tags">{p.year_text && <span>{p.year_text}</span>}{p.region && <span>{p.region}</span>}</div>
          <strong>{money(p.price)}</strong><em>상품 상세보기 ›</em>
        </div>
      </a>)}</div>}
  </div></section>;
}
