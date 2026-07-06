import Link from 'next/link';

async function getProducts() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  try {
    const res = await fetch(`${baseUrl}/api/products`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

const fallbackProducts = [
  { id: 'demo-1', name: '코지마 CMC-A100', brand: '코지마', model: 'CMC-A100', price: 890000, grade: 'A', status: '판매중', description: '상태 점검 완료 리퍼 상품입니다.', image_url: '' },
  { id: 'demo-2', name: '바디프랜드 팬텀', brand: '바디프랜드', model: 'Phantom', price: 1280000, grade: 'B+', status: '상담가능', description: '외관 사용감 있으나 주요 기능 정상입니다.', image_url: '' }
];

export default async function ProductsPage() {
  const dbProducts = await getProducts();
  const products = dbProducts.length ? dbProducts : fallbackProducts;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16">
      <section className="mx-auto max-w-6xl">
        <p className="font-bold text-blue-600">ReChair Market</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-6xl">판매 중인 중고 안마의자</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">관리자가 등록한 상품이 고객 화면에 노출됩니다. 상품 상세에서 바로 구매 상담으로 연결됩니다.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p: any) => (
            <Link key={p.id} href={`/products/${p.id}`} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex h-52 items-center justify-center rounded-2xl bg-slate-100 text-5xl">{p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full rounded-2xl object-cover" /> : '🛋️'}</div>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-600">{p.brand}</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">{p.status}</span>
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-950">{p.name}</h2>
              <p className="mt-2 text-slate-500">{p.model} · 등급 {p.grade}</p>
              <p className="mt-4 text-2xl font-black text-slate-950">{Number(p.price || 0).toLocaleString()}원</p>
              <p className="mt-4 text-sm font-bold text-blue-600 group-hover:underline">상세보기 →</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
