import AdminConsultations from '@/components/AdminConsultations';

export default function AdminPage() {
  return (
    <main className="admin-only-page">
      <section className="admin-title-wrap">
        <p className="admin-kicker">RECHAIR ADMIN</p>
        <h1>관리자 상담 CRM</h1>
        <p>고객 상담, 제품 사진, 처리 상태, 담당자 메모를 한 화면에서 관리합니다.</p>
      </section>

      <AdminConsultations />
    </main>
  );
}
