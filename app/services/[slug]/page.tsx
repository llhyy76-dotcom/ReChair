import Footer from '@/components/Footer';

const serviceData = {
  buy: {
    icon: '🛒',
    title: '중고 구매',
    subtitle: '검증된 중고·리퍼 안마의자를 합리적인 가격으로 상담 구매합니다.',
    points: ['제품 상태와 사용 이력 확인', '브랜드·모델별 추천', '배송·설치 가능 여부 안내'],
    cta: '구매 상담 신청',
  },
  sell: {
    icon: '🏷️',
    title: '중고 판매',
    subtitle: '사진과 모델명만 보내주시면 매입 가능 여부와 예상 견적을 빠르게 안내합니다.',
    points: ['모델명·제조번호 확인', '외관·작동 상태 기준 견적', '방문 수거 및 거래 일정 조율'],
    cta: '판매 견적 신청',
  },
  move: {
    icon: '🚚',
    title: '이전 설치',
    subtitle: '분해, 운반, 재설치까지 안마의자 이전 과정을 안전하게 진행합니다.',
    points: ['분해·포장·운반', '재설치 위치 확인', '계단·엘리베이터 조건 사전 확인'],
    cta: '이전설치 상담',
  },
  dispose: {
    icon: '♻️',
    title: '폐기 수거',
    subtitle: '사용하지 않는 안마의자를 지역 조건에 맞춰 회수·폐기 상담합니다.',
    points: ['제품 크기 및 설치 위치 확인', '수거 가능 일정 조율', '폐기·재활용 기준 안내'],
    cta: '폐기수거 상담',
  },
  repair: {
    icon: '🔧',
    title: '출장 수리',
    subtitle: '고장 증상 접수 후 가능한 일정으로 전문 기사 방문 수리를 상담합니다.',
    points: ['고장 증상 사전 확인', '부품 필요 여부 판단', '방문 가능 지역 및 일정 안내'],
    cta: '출장수리 접수',
  },
  parts: {
    icon: '⚙️',
    title: '부품 구매',
    subtitle: '모델별 부품 문의와 호환 여부를 확인하고 구매 가능 여부를 안내합니다.',
    points: ['모델명·부품명 확인', '호환 가능 여부 상담', '배송 가능 부품 안내'],
    cta: '부품 문의하기',
  },
} as const;

type ServiceSlug = keyof typeof serviceData;

type ServicePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ServiceDetailPage({ params }: ServicePageProps) {
  const { slug } = await params;
  const service = serviceData[slug as ServiceSlug] || serviceData.buy;

  return (
    <main>
      <section className="service-detail-hero">
        <div className="service-detail-card">
          <a className="service-back-link" href="/">← 메인으로</a>
          <div className="service-detail-icon">{service.icon}</div>
          <p className="eyebrow">ReChair Service</p>
          <h1>{service.title}</h1>
          <p className="service-detail-subtitle">{service.subtitle}</p>

          <div className="service-detail-points">
            {service.points.map((point) => (
              <div key={point}>
                <span>✓</span>
                <strong>{point}</strong>
              </div>
            ))}
          </div>

          <div className="service-detail-actions">
            <a className="primary-button" href="/#consult">{service.cta}</a>
            <a className="secondary-button" href="/#products">판매상품 보기</a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
