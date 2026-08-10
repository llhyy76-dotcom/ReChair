import './rental.css';
import RentalCatalog from '@/components/RentalCatalog';

const plans=[
  {
    key:'personal',
    eyebrow:'HOME RENTAL',
    title:'개인용 안마의자',
    description:'가정에서 편하게 사용하는 안마의자를 월 렌탈 방식으로 상담합니다.',
    points:['가정용 설치 환경 상담','모델·예산별 렌탈 상담','설치 및 사후관리 연계'],
    href:'/consult?service=rental-personal',
    cta:'개인용 렌탈 상담',
  },
  {
    key:'commercial',
    eyebrow:'BUSINESS / COIN',
    title:'영업용(코인형) 안마의자',
    description:'휴게공간·매장·사업장 등에 설치하는 코인형/영업용 안마의자를 상담합니다.',
    points:['사업장 설치 조건 검토','코인형 운영 모델 상담','대수·설치지역별 견적 상담'],
    href:'/consult?service=rental-commercial',
    cta:'영업용 렌탈 상담',
  },
];

export default function RentalPage(){
  return <main className="rental-page">
    <section className="rental-hero">
      <div>
        <p>RECHAIR RENTAL</p>
        <h1>안마의자 렌탈</h1>
        <span>사용 목적에 맞는 렌탈 형태를 선택해 주세요.</span>
      </div>
    </section>

    <section className="rental-grid">
      {plans.map(plan=><article className={'rental-card '+plan.key} key={plan.key}>
        <div className="rental-card-icon">{plan.key==='personal'?'⌂':'₩'}</div>
        <p>{plan.eyebrow}</p>
        <h2>{plan.title}</h2>
        <span>{plan.description}</span>
        <ul>{plan.points.map(point=><li key={point}>{point}</li>)}</ul>
        <a href={plan.href}>{plan.cta}</a>
      </article>)}
    </section>

    <RentalCatalog />

    <section className="rental-guide">
      <div><small>01</small><b>렌탈 유형 선택</b><span>개인용 또는 영업용을 선택합니다.</span></div>
      <div><small>02</small><b>설치 조건 상담</b><span>지역·공간·예산·희망 모델을 확인합니다.</span></div>
      <div><small>03</small><b>견적 및 설치</b><span>조건 확인 후 담당자가 렌탈 조건을 안내합니다.</span></div>
    </section>
  </main>;
}
