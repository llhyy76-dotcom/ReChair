'use client';

import { useState } from 'react';

export default function ConsultationForm() {
  const [done, setDone] = useState(false);

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDone(true);
  }

  return (
    <section id="consult" className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid gap-8 rounded-[2rem] bg-slate-950 p-6 text-white md:grid-cols-[.9fr_1.1fr] md:p-10">
        <div>
          <p className="font-black text-sky-300">Free Quote</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">사진만 보내도 빠르게 상담받을 수 있습니다.</h2>
          <p className="mt-5 leading-8 text-slate-300">
            중고 구매·판매, 이전설치, 폐기수거, 출장수리, 부품문의 중 필요한 서비스를 선택해 주세요.
          </p>
        </div>
        <form onSubmit={submitForm} className="grid gap-3 rounded-[1.5rem] bg-white p-5 text-slate-950">
          <div className="grid gap-3 md:grid-cols-2">
            <input required className="rounded-2xl border border-slate-200 p-4" placeholder="이름" />
            <input required className="rounded-2xl border border-slate-200 p-4" placeholder="연락처" />
          </div>
          <select className="rounded-2xl border border-slate-200 p-4">
            <option>중고 안마의자 구매</option>
            <option>내 안마의자 판매</option>
            <option>이전설치</option>
            <option>폐기수거</option>
            <option>출장수리</option>
            <option>부품구매</option>
          </select>
          <input className="rounded-2xl border border-slate-200 p-4" placeholder="브랜드/모델명 예: 코지마 CMC-A100" />
          <textarea className="min-h-32 rounded-2xl border border-slate-200 p-4" placeholder="문의 내용을 적어주세요" />
          <button className="rounded-2xl bg-gradient-to-r from-brand to-cyan py-4 font-black text-white">무료 상담 신청</button>
          {done && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">접수 시뮬레이션 완료. Supabase 연결 후 실제 DB 저장으로 전환됩니다.</p>}
        </form>
      </div>
    </section>
  );
}
