const services = [
  ['1','중고 구매','검수된 중고·리퍼 안마의자를 합리적인 가격으로 상담 판매합니다.'],
  ['2','중고 판매','사진과 모델명만 보내면 매입 가능 여부를 빠르게 안내합니다.'],
  ['3','이전설치','분해, 운반, 재설치까지 안전하게 예약 접수합니다.'],
  ['4','폐기수거','사용하지 않는 안마의자를 지역별 조건에 맞춰 수거합니다.'],
  ['5','출장수리','고장 증상 접수 후 가능한 일정으로 방문 상담합니다.'],
  ['6','부품구매','모델별 부품 문의와 호환 여부를 상담합니다.'],
]
export default function Services(){
  return <section id="services" className="section"><div className="section-inner"><p className="section-kicker">ReChair Service</p><h2 className="section-title">필요한 서비스를 바로 선택하세요</h2><div className="service-grid">{services.map(s=><div className="service-card" key={s[0]}><div className="service-no">{s[0]}</div><h3>{s[1]}</h3><p>{s[2]}</p></div>)}</div></div></section>
}
