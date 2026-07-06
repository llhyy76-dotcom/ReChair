import ProductAdmin from '@/components/ProductAdmin';

export default function AdminProductsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-14">
      <section className="mx-auto max-w-7xl">
        <p className="font-bold tracking-[0.35em] text-blue-600">RECHAIR ADMIN</p>
        <h1 className="mt-3 text-4xl font-black text-slate-950">상품관리 CMS</h1>
        <p className="mt-3 text-slate-600">관리자가 상품을 등록하면 고객 상품목록과 상세 페이지에 노출됩니다.</p>
        <div className="mt-10"><ProductAdmin /></div>
      </section>
    </main>
  );
}
