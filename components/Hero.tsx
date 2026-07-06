export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-inner">
        <div>
          <div className="badge">중고 안마의자 전문 고객센터</div>
          <h1>중고 안마의자,<br />구매·판매·수리까지<br />한 번에 해결하세요.</h1>
          <p>사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치, 폐기수거, 출장수리, 부품구매까지 빠르게 상담해드립니다.</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#consult">무료 견적 신청</a>
            <a className="btn btn-ghost" href="#products">판매상품 보기</a>
          </div>
        </div>
        <div className="hero-card-wrap">
          <div className="hero-card">
            <h3>오늘 상담 현황</h3>
            <div className="stats">
              <div className="stat"><strong>31</strong><span>신규 상담</span></div>
              <div className="stat"><strong>18</strong><span>예약 문의</span></div>
              <div className="stat"><strong>7</strong><span>상품 문의</span></div>
            </div>
            <div className="quick"><b>ReChair 빠른 상담</b><p>접수 후 담당자가 순차적으로 연락드립니다.</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}
