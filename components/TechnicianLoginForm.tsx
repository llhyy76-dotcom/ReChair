'use client';

import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function TechnicianLoginForm(){
  const router=useRouter();
  const [name,setName]=useState('');
  const [pin,setPin]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);

  async function submit(e:FormEvent){
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const r=await fetch('/api/technician/auth/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,pin}),
    });
    const j=await r.json();
    setLoading(false);

    if(!r.ok){
      setMessage(j.error||'로그인에 실패했습니다.');
      return;
    }

    router.replace('/technician');
    router.refresh();
  }

  return <form className="tech-login-card" onSubmit={submit}>
    <div>
      <p>RECHAIR FIELD</p>
      <h1>기사 로그인</h1>
      <span>본인 기사·팀 이름과 PIN을 입력하세요.</span>
    </div>

    <label>
      <span>기사·팀 이름</span>
      <input
        value={name}
        onChange={e=>setName(e.target.value)}
        placeholder="예: 경기 북부팀"
        autoComplete="username"
      />
    </label>

    <label>
      <span>PIN</span>
      <input
        value={pin}
        onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,8))}
        placeholder="숫자 PIN"
        inputMode="numeric"
        type="password"
        autoComplete="current-password"
      />
    </label>

    {message&&<aside>{message}</aside>}

    <button disabled={loading||!name.trim()||pin.length<4}>
      {loading?'확인 중':'로그인'}
    </button>
  </form>
}
