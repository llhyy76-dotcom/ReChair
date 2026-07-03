import Header from '@/components/Header';
import ConsultForm from '@/components/ConsultForm';

export default function Home(){
  return <>
    <Header />
    <main>
      <section className="wrap hero">
        <div><span className="badge">중고 안마의자 전문 고객센터</span><h1>중고 안마의자,<br/>판매·매입·수리까지<br/>한 번에 해결하세요.</h1><p>사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치, 폐기수거, 제품 수리, 부품 구매까지 빠르게 상담해드립니다.</p><a className="cta" href="#contact" style={{display:'inline-block',marginTop:20,textDecoration:'none'}}>무료 견적 신청</a></div>
        <div className="card" id="contact"><h2>무료 상담 신청</h2><ConsultForm /></div>
      </section>
      <section className="services" id="services"><div className="wrap"><h2 className="section-title">ReChair 수익 서비스</h2><p className="section-desc">고객이 필요한 상황별로 바로 상담 신청할 수 있게 구성했습니다.</p><div className="grid">
        {['중고 안마의자 구매','내 안마의자 판매','이전설치','폐기수거','출장 수리','부품 구매'].map((x,i)=><article className="service" key={x}><b>{x}</b><p>{['검수된 중고·리퍼 상품 상담 판매','사진과 모델명 기반 빠른 매입 상담','이사·중고거래 후 안전한 분해/운반/설치','사용하지 않는 제품 폐기 및 수거 상담','고장 증상 접수 후 방문 수리 상담','모델별 호환 부품 구매 문의'][i]}</p></article>)}
      </div></div></section>
    </main><footer className="footer">© 2026 ReChair</footer></>
}
