import Header from '@/components/Header';
import AdminConsultations from '@/components/AdminConsultations';
import Footer from '@/components/Footer';

export default function AdminPage() {
  return (
    <>
      <Header />
      <main className="admin-layout">
        <div className="container">
          <p style={{ color: '#2769ff', fontWeight: 900, letterSpacing: 6 }}>
            RECHAIR ADMIN
          </p>
          <h1 style={{ fontSize: 42 }}>관리자 상담 CRM</h1>
          <p style={{ color: '#64748b' }}>
            고객 상담, 제품 사진, 처리 상태, 담당자 메모를 한 화면에서 관리합니다.
          </p>
          <AdminConsultations />
        </div>
      </main>
      <Footer />
    </>
  );
}
