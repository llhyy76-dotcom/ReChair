'use client';
import { useState } from 'react';

export default function ConsultForm(){
  const [done,setDone]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try{
      const res = await fetch('/api/consultations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!res.ok) throw new Error('fail');
      setDone(true); e.currentTarget.reset();
    }catch{
      alert('접수 저장 준비 중입니다. Supabase 환경변수 설정 후 동작합니다.');
    }
  }
  return <form className="form" onSubmit={submit}>
    <input name="name" placeholder="이름" required />
    <input name="phone" placeholder="연락처" required />
    <select name="service_type" required><option>중고 안마의자 구매</option><option>내 안마의자 판매</option><option>출장 수리</option><option>이전설치</option><option>폐기수거</option><option>부품 구매</option></select>
    <input name="region" placeholder="지역 예: 경기 고양시" />
    <input name="model" placeholder="브랜드/모델명 예: 코지마 CMC-A100" />
    <textarea name="message" placeholder="문의 내용을 적어주세요" />
    <button className="button">무료 상담 신청</button>
    {done && <p style={{color:'#2563eb',fontWeight:900}}>접수되었습니다. 관리자가 확인 후 연락드립니다.</p>}
  </form>
}
