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
    <section className="rc-final-hero rc-pc-wide-hero">
      <div className="rc-final-shell rc-pc-wide-shell">
        <div className="rc-pc-wide-main">
          <div className="rc-pc-wide-copy">
            <p className="rc-final-eyebrow">중고 안마의자 전문 고객센터</p>
            <h1>
              중고 안마의자,<br />
              구매 <span>·</span> 판매 <span>·</span> 수리까지<br />
              한 번에 <em>해결</em>하세요.
            </h1>
            <p className="rc-final-desc">
              사진과 모델명만 남겨주시면 중고 구매, 판매,<br />
              이전설치, 폐기수거, 출장수리, 부품구매까지<br />
              빠르게 상담해드립니다.
            </p>
          </div>

          <div className="rc-wide-chair-stage" aria-hidden="true">
            <div className="rc-wide-blue-lines" />
            <div className="rc-wide-chair-real">
              <div className="rc-wide-chair-back" />
              <div className="rc-wide-chair-pillow" />
              <div className="rc-wide-chair-inner" />
              <div className="rc-wide-chair-seat" />
              <div className="rc-wide-chair-arm-left" />
              <div className="rc-wide-chair-arm-right" />
              <div className="rc-wide-chair-legrest" />
              <div className="rc-wide-chair-base" />
              <div className="rc-wide-chair-gold-line" />
            </div>
          </div>
        </div>

        <div className="rc-final-service-grid rc-pc-wide-service-grid" id="service-menu">
          {services.map((service) => (
            <a className="rc-final-service-card rc-pc-wide-service-card" href={service.href} key={service.label}>
              <span className="rc-final-icon">{service.icon}</span>
              <strong>{service.label}</strong>
              <small>{service.desc}</small>
              <b>›</b>
            </a>
          ))}
        </div>

        <div className="rc-final-cta-row rc-pc-wide-cta-row">
          <a className="rc-final-quote" href="#consult">
            <span>📝</span>
            <div><strong>무료 견적 신청</strong><small>간편하게 견적을 받아보세요</small></div>
            <b>›</b>
          </a>
          <a className="rc-final-product" href="#products">
            <span>🛍️</span>
            <div><strong>판매상품 보기</strong><small>다양한 중고 안마의자를 확인하세요</small></div>
            <b>›</b>
          </a>
        </div>
      </div>
    </section>
  );
}
