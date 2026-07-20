'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function AdminAccountBar(){
  const router=useRouter();
  const [session,setSession]=useState<any>(null);

  useEffect(()=>{
    fetch('/api/admin/me',{cache:'no-store'})
      .then(r=>r.json().then(j=>({ok:r.ok,j})))
      .then(({ok,j})=>{if(ok)setSession(j.data)});
  },[]);

  async function logout(){
    await fetch('/api/admin/auth/logout',{method:'POST'});
    router.replace('/admin/login');
    router.refresh();
  }

  return <div className="admin-account-bar">
    <div>
      <small>ADMIN SESSION</small>
      <b>{session?.role==='admin'?'관리자 로그인 중':'관리자'}</b>
      {session?.expires_at&&<span>만료 {new Date(session.expires_at).toLocaleString('ko-KR')}</span>}
    </div>
    <a href="/admin/security">보안 기록</a>
    <button onClick={logout}>로그아웃</button>
  </div>
}
