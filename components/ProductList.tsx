const products = [
  { name: '코지마 CMC-A100', price: '상담가', grade: 'A급', note: '외관 양호 · 기본 작동 점검' },
  { name: '바디프랜드 팬텀', price: '상담가', grade: 'B+급', note: '이전설치 상담 가능' },
  { name: '세라젬 V7', price: '상담가', grade: 'A급', note: '문의량 높은 모델' }
];

export default function ProductList() {
  return (
    <section id="products" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-black text-brand">ReMarket</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">판매 중인 중고상품</h2>
          </div>
          <a href="#consult" className="font-black text-brand">상품 문의하기 →</a>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {products.map((product) => (
            <article key={product.name} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              <div className="flex h-52 items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100 text-5xl">🛋️</div>
              <div className="p-6">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{product.grade}</span>
                <h3 className="mt-4 text-xl font-black">{product.name}</h3>
                <p className="mt-2 text-slate-600">{product.note}</p>
                <div className="mt-5 flex items-center justify-between">
                  <strong className="text-2xl font-black">{product.price}</strong>
                  <a href="#consult" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">상담</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
