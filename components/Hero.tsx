export default function Hero() {
  const quickMenus = [
    { label: '중고구매', href: '#products' },
    { label: '중고판매', href: '#consult' },
    { label: '이전설치', href: '#consult' },
    { label: '폐기수거', href: '#consult' },
    { label: '출장수리', href: '#consult' },
    { label: '부품구매', href: '#consult' },
  ];

  return (
    <section className="hero">
      <div className="hero-inner hero-mobile-compact">
        <div className="hero-copy">
          <p className="eyebrow">중고 안마의자 전문 고객센터</p>

          <h1>
            중고 안마의자,
            <br />
            구매·판매·수리까지
            <br />
            한 번에 해결하세요.
          </h1>

          <p className="hero-copy-text">
            사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치, 폐기수거,
            출장수리, 부품구매까지 빠르게 상담해드립니다.
          </p>

          <div className="hero-quick-menu" aria-label="주요 서비스 바로가기">
            {quickMenus.map((menu) => (
              <a key={menu.label} href={menu.href}>
                {menu.label}
              </a>
            ))}
          </div>

          <div className="hero-actions">
            <a className="primary-button" href="#consult">
              무료 견적 신청
            </a>
            <a className="secondary-button" href="#products">
              판매상품 보기
            </a>
          </div>
        </div>

        <div className="hero-dashboard" aria-label="ReChair 상담 요약">
          <div className="dashboard-card">
            <span>상담</span>
            <strong>빠른견적</strong>
          </div>
          <div className="dashboard-stats">
            <div>
              <strong>6</strong>
              <span>서비스</span>
            </div>
            <div>
              <strong>4</strong>
              <span>사진접수</span>
            </div>
            <div>
              <strong>1:1</strong>
              <span>상담관리</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
