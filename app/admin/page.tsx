import { cookies } from 'next/headers';
import AdminConsultations from '@/components/AdminConsultations';
import AdminLogin from '@/components/AdminLogin';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get('rechair_admin_auth')?.value === 'ok';

  return (
    <main className="admin-only-page">
      <section className="admin-title-wrap">
        <p className="admin-kicker">RECHAIR ADMIN</p>
        <h1>관리자 상담 CRM</h1>
        <p>고객 상담, 제품 사진, 처리 상태, 담당자 메모를 한 화면에서 관리합니다.</p>
      </section>

      {isAuthed ? <AdminConsultations /> : <AdminLogin />}
    </main>
  );
}
