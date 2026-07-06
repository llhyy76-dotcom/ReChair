import Header from '@/components/Header';
import AdminConsultations from '@/components/AdminConsultations';

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Header />
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-600">ReChair Admin</p>
          <h1 className="mt-3 text-4xl font-black text-slate-950">관리자 상담 CRM</h1>
          <p className="mt-3 text-slate-500">고객 상담, 제품 사진, 처리 상태, 담당자 메모를 한 화면에서 관리합니다.</p>
        </div>
        <AdminConsultations />
      </section>
    </main>
  );
}
