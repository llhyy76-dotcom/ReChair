import Link from 'next/link';

type Props = { params: Promise<{ id: string }> };

async function getProduct(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  try {
    const res = await fetch(`${baseUrl}/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;
  const product = await getProduct(id) || {
    id,
    name: '코지마 CMC-A100', brand: '코지마', model: 'CMC-A100', price: 890000, grade: 'A', status: '판매중', description: '상태 점검 완료 리퍼 상품입니다. 상담 후 배송/설치 일정을 확정합니다.', image_url: ''
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16">
      <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="flex h-[420px] items-center justify-center rounded-[1.5rem] bg-slate-100 text-7xl">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full rounded-[1.5rem] object-cover" /> : '🛋️'}</div>
        </div>
        <div>
          <p className="font-bold text-blue-600">{product.brand}</p>
          <h1 className="mt-3 text-4xl font-black text-slate-950 md:text-6xl">{product.name}</h1>
          <p className="mt-4 text-xl text-slate-600">{product.model} · 등급 {product.grade}</p>
          <p className="mt-8 text-4xl font-black text-slate-950">{Number(product.price || 0).toLocaleString()}원</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">상태</p><p className="font-black">{product.status}</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">등급</p><p className="font-black">{product.grade}</p></div>
            <div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">상담</p><p className="font-black">가능</p></div>
          </div>
          <p className="mt-8 rounded-3xl bg-white p-6 text-slate-700">{product.description}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/#consult" className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 text-center font-black text-white">구매 상담 신청</Link>
            <Link href="/products" className="rounded-2xl border border-slate-300 px-8 py-4 text-center font-black text-slate-900">목록으로</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
