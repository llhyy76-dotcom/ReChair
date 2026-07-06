'use client';

import { useEffect, useState } from 'react';

type Product = {
  id?: string;
  name: string;
  brand: string;
  model: string;
  grade: string;
  status: string;
  price: number;
  image_url?: string;
  description?: string;
};

const empty: Product = { name: '', brand: '', model: '', grade: 'A', status: '판매중', price: 0, image_url: '', description: '' };

export default function ProductAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<Product>(empty);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch('/api/products', { cache: 'no-store' });
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setLoading(true);
    const method = form.id ? 'PATCH' : 'POST';
    const url = form.id ? `/api/products/${form.id}` : '/api/products';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm(empty);
    await load();
    setLoading(false);
  }

  async function remove(id?: string) {
    if (!id || !confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black">상품 등록</h2>
        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border p-3" placeholder="상품명" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="브랜드" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="모델명" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="대표 이미지 URL" value={form.image_url || ''} onChange={e => setForm({ ...form, image_url: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="판매가" type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-xl border p-3" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
              <option>A+</option><option>A</option><option>B+</option><option>B</option><option>C</option>
            </select>
            <select className="rounded-xl border p-3" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>판매중</option><option>상담가능</option><option>예약중</option><option>판매완료</option>
            </select>
          </div>
          <textarea className="min-h-28 rounded-xl border p-3" placeholder="상품 설명" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <button onClick={save} disabled={loading} className="rounded-xl bg-blue-600 p-4 font-black text-white">{form.id ? '상품 수정' : '상품 등록'}</button>
        </div>
      </section>
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black">등록 상품</h2>
        <div className="mt-6 grid gap-3">
          {products.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <p className="font-black">{p.name}</p>
                <p className="text-sm text-slate-500">{p.brand} · {p.model} · {Number(p.price || 0).toLocaleString()}원</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm(p)} className="rounded-lg border px-3 py-2 font-bold">수정</button>
                <button onClick={() => remove(p.id)} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white">삭제</button>
              </div>
            </div>
          ))}
          {!products.length && <p className="rounded-2xl bg-slate-50 p-5 text-slate-500">등록된 상품이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
