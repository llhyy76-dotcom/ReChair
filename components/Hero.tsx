export default function Hero() {
  const services = [
    { label: '중고 구매', desc: '검증된 중고 안마의자 구매', icon: '🛒', href: '/services/buy' },
    { label: '중고 판매', desc: '간편하게 판매 상담', icon: '🏷️', href: '/services/sell' },
    { label: '이전 설치', desc: '안전하고 신속한 설치', icon: '🚚', href: '/services/move' },
    { label: '폐기 수거', desc: '안마의자 회수·폐기', icon: '♻️', href: '/services/dispose' },
    { label: '출장 수리', desc: '전문 기사 방문 수리', icon: '🔧', href: '/services/repair' },
    { label: '부품 구매', desc: '정품 부품 빠른 발송', icon: '⚙️', href: '/services/parts' },
  ];

  return (
    <section className="rc-hero">
      <div className="rc-hero-shell">
        <div className="rc-hero-top">
          <div className="rc-hero-copy">
            <p className="rc-eyebrow">중고 안마의자 전문 고객센터</p>
            <h1>
              중고 안마의자,<br />
              구매<span>·</span>판매<span>·</span>수리까지<br />
              한 번에 <em>해결</em>하세요.
            </h1>
            <p className="rc-hero-desc">
              사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치,
              폐기수거, 출장수리, 부품구매까지 빠르게 상담해드립니다.
            </p>
          </div>

          <div className="rc-chair-wrap rc-desktop-chair" aria-hidden="true">
            <div className="rc-chair-glow" />
            <div className="rc-chair">
              <div className="rc-chair-head" />
              <div className="rc-chair-back" />
              <div className="rc-chair-body" />
              <div className="rc-chair-arm" />
              <div className="rc-chair-base" />
              <div className="rc-chair-line" />
            </div>
          </div>
        </div>

        <div className="rc-service-grid" id="service-menu">
          {services.map((service) => (
            <a className="rc-service-card" href={service.href} key={service.label}>
              <span className="rc-service-icon">{service.icon}</span>
              <strong>{service.label}</strong>
              <small>{service.desc}</small>
              <b>›</b>
            </a>
          ))}
        </div>

        <div className="rc-cta-row">
          <a className="rc-quote-btn" href="#consult">
            <span>📝</span><strong>무료 견적 신청</strong><em>간편하게 견적을 받아보세요</em><b>›</b>
          </a>
          <a className="rc-product-btn" href="#products">
            <span>🛍️</span><strong>판매상품 보기</strong><em>다양한 중고 안마의자를 확인하세요</em><b>›</b>
          </a>
        </div>

        <div className="rc-trust-bar">
          <div><span>🛡️</span><strong>신뢰</strong><small>정품 부품 사용<br />투명한 서비스</small></div>
          <div><span>🔄</span><strong>순환</strong><small>자원 재활용을 통한<br />가치 있는 순환</small></div>
          <div><span>🤝</span><strong>연결</strong><small>전문가와 고객을<br />연결하는 플랫폼</small></div>
        </div>
      </div>
    </section>
  );
}
