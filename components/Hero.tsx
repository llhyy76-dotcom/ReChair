export default function Hero() {
  const services = [
    { label: '중고 구매', icon: 'cart', desc: '검증된 중고 안마의자 구매' },
    { label: '중고 판매', icon: 'tag', desc: '간편하게 판매 상담' },
    { label: '이전 설치', icon: 'truck', desc: '안전하고 신속한 설치' },
    { label: '폐기 수거', icon: 'recycle', desc: '안마의자 회수·폐기' },
    { label: '출장 수리', icon: 'wrench', desc: '전문 기사 방문 수리' },
    { label: '부품 구매', icon: 'gear', desc: '정품 부품 빠른 발송' },
  ];

  return (
    <section className="hero rechair-app-hero">
      <div className="hero-inner">
        <div className="hero-content">
          <p className="eyebrow">중고 안마의자 전문 고객센터</p>

          <div className="hero-main">
            <div className="hero-copy">
              <h1>
                중고 안마의자,
                <br />
                구매<span>·</span>판매<span>·</span>수리까지
                <br />
                한 번에 해결하세요.
              </h1>

              <p>
                사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치,
                폐기수거, 출장수리, 부품구매까지 빠르게 상담해드립니다.
              </p>
            </div>

            <div className="hero-chair" aria-hidden="true">
              <div className="chair-shape">
                <div className="chair-head" />
                <div className="chair-back" />
                <div className="chair-seat" />
                <div className="chair-arm" />
                <div className="chair-leg" />
              </div>
            </div>
          </div>

          <div className="service-tile-grid">
            {services.map((service) => (
              <a href={service.label === '중고 구매' ? '#products' : '#consult'} className="service-tile" key={service.label}>
                <i className={`tile-icon icon-${service.icon}`} />
                <strong>{service.label}</strong>
                <small>{service.desc}</small>
                <em>›</em>
              </a>
            ))}
          </div>

          <div className="hero-cta-stack">
            <a className="hero-main-cta" href="#consult">
              <span className="cta-doc" />
              무료 견적 신청
              <b>›</b>
            </a>
            <a className="hero-product-cta" href="#products">
              <span className="cta-bag" />
              판매상품 보기
              <b>›</b>
            </a>
          </div>

          <div className="trust-strip">
            <div>
              <i className="trust-icon trust-shield" />
              <strong>신뢰</strong>
              <span>정품 부품 사용<br />투명한 서비스</span>
            </div>
            <div>
              <i className="trust-icon trust-cycle" />
              <strong>순환</strong>
              <span>자원 재활용을 통한<br />가치 있는 순환</span>
            </div>
            <div>
              <i className="trust-icon trust-hand" />
              <strong>연결</strong>
              <span>전문가와 고객을<br />연결하는 플랫폼</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
