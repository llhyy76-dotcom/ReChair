export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="eyebrow">중고 안마의자 전문 고객센터</span>
          <h1>중고 안마의자,<br />구매·판매·수리까지<br />한 번에 해결하세요.</h1>
          <p>
            사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치, 폐기수거,
            출장수리, 부품구매까지 빠르게 상담해드립니다.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="/#consult">무료 견적 신청</a>
            <a className="secondary-button" href="/products">판매상품 보기</a>
          </div>
        </div>

        <div className="hero-dashboard" aria-label="오늘 상담 현황">
          <div className="dashboard-card">
            <p className="dashboard-title">오늘 상담 현황</p>
            <div className="dashboard-stats">
              <div><strong>31</strong><span>신규 상담</span></div>
              <div><strong>18</strong><span>예약 문의</span></div>
              <div><strong>7</strong><span>상품 문의</span></div>
            </div>
            <div className="dark-info-card">
              <strong>ReChair 빠른 상담</strong>
              <span>접수 후 담당자가 순차적으로 연락드립니다.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
