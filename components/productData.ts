export const products = [
  {
    id: 'cmc-1300',
    name: 'CMC-1300',
    brand: '코지마',
    grade: 'A급',
    price: 1450000,
    status: '판매중',
    year: '2023년식',
    region: '수도권',
    image: '🛋️',
    summary: '외관 상태가 양호하고 기본 작동 점검이 완료된 중고 안마의자입니다.',
    features: ['기본 작동 점검 완료', '외관 상태 양호', '수도권 배송 상담 가능'],
  },
  {
    id: 'x5000-g',
    name: 'X5000(G) 리퍼',
    brand: '코지마',
    grade: '리퍼',
    price: 1500000,
    status: '상담가능',
    year: '리퍼 상품',
    region: '전국 상담',
    image: '💺',
    summary: '리퍼 특별가 적용 상품으로 보상판매 상담에 적합한 모델입니다.',
    features: ['리퍼 특별가', '보상판매 추천', '설치 상담 가능'],
  },
  {
    id: 'ceragem-master',
    name: '마스터 V4',
    brand: '세라젬',
    grade: 'B+급',
    price: 1200000,
    status: '입고예정',
    year: '2022년식',
    region: '방문 확인',
    image: '🛏️',
    summary: '상태 확인 후 판매 전환 예정인 척추 온열 마사지기입니다.',
    features: ['입고 예정', '상태 확인 필요', '가격 상담 가능'],
  },
];

export function formatPrice(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}
