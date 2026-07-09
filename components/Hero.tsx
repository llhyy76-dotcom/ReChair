export default function Hero() {
  const services = [
    { label: '중고 구매', desc: '검증된 제품을 합리적인 가격으로', icon: '🛒', href: '/services/buy' },
    { label: '중고 판매', desc: '간편하게 매입 빠른 상담', icon: '🏷️', href: '/services/sell' },
    { label: '이전 설치', desc: '분해, 운반, 재설치 안전하게', icon: '🚚', href: '/services/move' },
    { label: '폐기수거', desc: '사용하지 않는 제품 깔끔하게 처리', icon: '♻️', href: '/services/dispose' },
    { label: '출장 수리', desc: '전문 기사 방문 신속한 수리', icon: '🔧', href: '/services/repair' },
    { label: '부품 구매', desc: '모델별 부품 문의 정품 부품 제공', icon: '⚙️', href: '/services/parts' },
  ];

  return (
    <section className="rc-hero rc-leftmock-hero">
      <div className="rc-hero-shell rc-leftmock-shell">
        <div className="rc-hero-copy">
          <p className="rc-eyebrow">중고 안마의자 전문 고객센터</p>
          <h1>
            중고 안마의자,<br />
            구매<span>·</span>판매<span>·</span>수리까지<br />
            한 번에 <em>해결</em>하세요.
          </h1>
          <p className="rc-hero-desc">
            사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치, 폐기수거,
            출장수리, 부품구매까지 빠르게 상담해드립니다.
          </p>
        </div>

        <div className="rc-service-grid rc-leftmock-service-grid" id="service-menu">
          {services.map((service) => (
            <a className="rc-service-card rc-leftmock-service-card" href={service.href} key={service.label}>
              <span className="rc-service-icon">{service.icon}</span>
              <strong>{service.label}</strong>
              <small>{service.desc}</small>
              <b>›</b>
            </a>
          ))}
        </div>

        <div className="rc-cta-row rc-leftmock-cta-row">
          <a className="rc-quote-btn" href="#consult">
            <span>📝</span><strong>무료 견적 신청</strong><em>간편하게 견적을 받아보세요</em><b>›</b>
          </a>
          <a className="rc-product-btn" href="#products">
            <span>🛍️</span><strong>판매상품 보기</strong><em>다양한 중고 안마의자를 확인하세요</em><b>›</b>
          </a>
        </div>

        <div className="rc-trust-bar rc-leftmock-trust">
          <div><span>🛡️</span><strong>신뢰</strong><small>정품 부품 사용<br />투명한 서비스</small></div>
          <div><span>🔄</span><strong>순환</strong><small>자원 재활용을 통한<br />가치 있는 순환</small></div>
          <div><span>🤝</span><strong>연결</strong><small>전문가와 고객을<br />연결하는 플랫폼</small></div>
        </div>
      </div>
    </section>
  );
}
