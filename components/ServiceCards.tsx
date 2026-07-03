const services = [
  ['중고 구매', '검수된 중고·리퍼 안마의자를 합리적인 가격으로 상담 판매합니다.'],
  ['중고 판매', '사진과 모델명만 보내면 매입 가능 여부를 빠르게 안내합니다.'],
  ['이전설치', '분해, 운반, 재설치까지 안전하게 예약 접수합니다.'],
  ['폐기수거', '사용하지 않는 안마의자를 지역별 조건에 맞춰 수거합니다.'],
  ['출장수리', '고장 증상 접수 후 가능한 일정으로 방문 상담합니다.'],
  ['부품구매', '모델별 부품 문의와 호환 여부를 상담합니다.']
];

export default function ServiceCards() {
  return (
    <section id="services" className="mx-auto max-w-6xl px-5 py-20">
      <div className="mb-10 text-center">
        <p className="font-black text-brand">ReChair Service</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">필요한 서비스를 바로 선택하세요</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {services.map(([title, desc], idx) => (
          <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-lg font-black text-brand">{idx + 1}</span>
            <h3 className="mt-5 text-xl font-black">{title}</h3>
            <p className="mt-3 leading-7 text-slate-600">{desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
