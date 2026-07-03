export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1.05fr_.95fr] md:py-28">
        <div>
          <p className="mb-5 inline-flex rounded-full bg-blue-500/15 px-4 py-2 text-sm font-black text-sky-200">
            중고 안마의자 전문 고객센터
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight md:text-6xl">
            중고 안마의자,
            <br />구매·판매·수리까지
            <br />한 번에 해결하세요.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            사진과 모델명만 남겨주시면 중고 구매, 판매, 이전설치, 폐기수거, 출장수리, 부품구매까지 빠르게 상담해드립니다.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#consult" className="rounded-2xl bg-gradient-to-r from-brand to-cyan px-7 py-4 text-center font-black text-white">
              무료 견적 신청
            </a>
            <a href="#products" className="rounded-2xl border border-white/20 px-7 py-4 text-center font-black text-white">
              판매상품 보기
            </a>
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="rounded-[1.5rem] bg-white p-6 text-slate-950">
            <p className="text-sm font-black text-brand">오늘 상담 현황</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[['31','신규 상담'],['18','예약 문의'],['7','상품 문의']].map(([num,label]) => (
                <div key={label} className="rounded-2xl bg-slate-100 p-4">
                  <strong className="block text-3xl font-black">{num}</strong>
                  <span className="text-xs font-bold text-slate-500">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
              <p className="font-black">ReChair 빠른 상담</p>
              <p className="mt-2 text-sm text-slate-300">접수 후 담당자가 순차적으로 연락드립니다.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
