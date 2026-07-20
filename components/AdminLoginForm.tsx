'use client';
import {FormEvent,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';

export default function AdminLoginForm(){
  const router=useRouter();
  const params=useSearchParams();
  const [password,setPassword]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);

  async function submit(e:FormEvent){
    e.preventDefault(); setLoading(true); setMessage('');
    const r=await fetch('/api/admin/auth/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password})
    });
    const j=await r.json(); setLoading(false);
    if(!r.ok){setMessage(j.error||'로그인 실패');return;}
    const next=params.get('next');
    router.replace(next&&next.startsWith('/admin')?next:'/admin/dashboard');
    router.refresh();
  }

  return <form className="admin-login-card" onSubmit={submit}>
    <div><p>RECHAIR ADMIN</p><h1>관리자 로그인</h1><span>관리자 비밀번호를 입력하세요.</span></div>
    <label><span>비밀번호</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="관리자 비밀번호"/></label>
    {message&&<aside>{message}</aside>}
    <button disabled={loading||!password}>{loading?'확인 중':'로그인'}</button>
  </form>
}
