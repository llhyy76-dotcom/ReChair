import ConsultationForm from '@/components/ConsultationForm';
import Footer from '@/components/Footer';

export default function ConsultPage() {
  return (
    <main className="rc-consult-page">
      <section className="rc-consult-page-hero">
        <div className="container">
          <p className="eyebrow">RECHAIR CONSULTATION</p>
          <h1>무료 상담 신청</h1>
          <p>원하시는 서비스와 제품 정보를 남겨주시면 담당자가 확인 후 연락드립니다.</p>
        </div>
      </section>

      <ConsultationForm />
      <Footer />
    </main>
  );
}
