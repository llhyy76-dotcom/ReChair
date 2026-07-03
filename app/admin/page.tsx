import Header from '@/components/Header';

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      <Header />
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-4xl font-black">ReChair 관리자</h1>
        <p className="mt-3 text-slate-600">상담 접수, 상품, 예약 관리를 위한 관리자 화면입니다.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[['신규 상담','0'],['예약 문의','0'],['등록 상품','3']].map(([label,value]) => (
            <article key={label} className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-sm font-black text-slate-500">{label}</p>
              <strong className="mt-3 block text-4xl font-black">{value}</strong>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black">상담 접수 목록</h2>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-4 bg-slate-50 p-4 text-sm font-black">
              <span>접수일</span><span>고객</span><span>서비스</span><span>상태</span>
            </div>
            <div className="grid grid-cols-4 p-4 text-sm text-slate-600">
              <span>-</span><span>접수 전</span><span>-</span><span>대기</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
