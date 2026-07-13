export default function Hero() {
  const services = [
    { key: 'buy', label: '중고 구매', desc: '검증된 제품을 합리적인 가격으로', icon: '🛒' },
    { key: 'sell', label: '중고 판매', desc: '간편하게 매입 빠른 상담', icon: '🏷️' },
    { key: 'move', label: '이전 설치', desc: '분해, 운반, 재설치 안전하게', icon: '🚚' },
    { key: 'dispose', label: '폐기수거', desc: '사용하지 않는 제품 깔끔하게 처리', icon: '♻️' },
    { key: 'repair', label: '출장 수리', desc: '전문 기사 방문 신속한 수리', icon: '🔧' },
    { key: 'parts', label: '부품 구매', desc: '모델별 부품 문의 정품 부품 제공', icon: '⚙️' },
  ];

  return (
    <section className="rc-final-hero rc-consult-entry-hero">
      <div className="rc-final-shell">
        <p className="rc-final-eyebrow">중고 안마의자 전문 고객센터</p>

        <h1>
          중고 안마의자,<br />
          구매 <span>·</span> 판매 <span>·</span> 수리까지<br />
          한 번에 <em>해결</em>하세요.
        </h1>

        <p className="rc-final-desc">
          사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치, 폐기수거,
          출장수리, 부품구매까지 빠르게 상담해드립니다.
        </p>

        <div className="rc-final-service-grid" id="service-menu">
          {services.map((service) => (
            <a
              className="rc-final-service-card"
              href={`/consult?service=${service.key}`}
              key={service.key}
            >
              <span className="rc-final-icon">{service.icon}</span>
              <strong>{service.label}</strong>
              <small>{service.desc}</small>
              <b>›</b>
            </a>
          ))}
        </div>

        <div className="rc-final-cta-row">
          <a className="rc-final-quote" href="/consult">
            <span>📝</span>
            <div>
              <strong>무료 견적 신청</strong>
              <small>서비스를 직접 선택해 상담을 신청하세요</small>
            </div>
            <b>›</b>
          </a>

          <a className="rc-final-product" href="/#products">
            <span>🛍️</span>
            <div>
              <strong>판매상품 보기</strong>
              <small>다양한 중고 안마의자를 확인하세요</small>
            </div>
            <b>›</b>
          </a>
        </div>
      </div>
    </section>
  );
}
