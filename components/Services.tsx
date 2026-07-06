const services = [
  { no: '1', title: '중고 구매', desc: '검수된 중고·리퍼 안마의자를 합리적인 가격으로 상담 판매합니다.' },
  { no: '2', title: '중고 판매', desc: '사진과 모델명만 보내면 매입 가능 여부를 빠르게 안내합니다.' },
  { no: '3', title: '이전설치', desc: '분해, 운반, 재설치까지 안전하게 예약 접수합니다.' },
  { no: '4', title: '폐기수거', desc: '사용하지 않는 안마의자를 지역별 조건에 맞춰 수거합니다.' },
  { no: '5', title: '출장수리', desc: '고장 증상 접수 후 가능한 일정으로 방문 상담합니다.' },
  { no: '6', title: '부품구매', desc: '모델별 부품 문의와 호환 여부를 상담합니다.' },
];

export default function Services() {
  return (
    <section id="services" className="section service-section">
      <div className="section-heading">
        <span>ReChair Service</span>
        <h2>필요한 서비스를 바로 선택하세요</h2>
      </div>
      <div className="service-grid">
        {services.map((item) => (
          <a className="service-card" href="/#consult" key={item.no}>
            <div className="service-number">{item.no}</div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
