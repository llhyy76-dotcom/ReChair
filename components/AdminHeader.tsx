'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';

const menus=[
  {href:'/admin/dashboard',label:'대시보드'},
  {href:'/admin/consultations',label:'상담 CRM'},
  {href:'/admin/products',label:'상품관리'},
  {href:'/admin/schedule',label:'AS 캘린더'},
  {href:'/admin/dispatch',label:'자동배정'},
  {href:'/admin/routes',label:'방문동선'},
  {href:'/admin/technicians',label:'기사관리'},
  {href:'/admin/technician-access',label:'접근권한'},
  {href:'/admin/security',label:'보안기록'},
];

export default function AdminHeader(){
  const pathname=usePathname();
  const router=useRouter();
  const [session,setSession]=useState<any>(null);
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      try{
        const r=await fetch('/api/admin/me',{cache:'no-store'});
        const j=await r.json();

        if(r.status===401){
          router.replace('/admin/login');
          return;
        }

        if(mounted&&r.ok){
          setSession(j.data);
        }
      }catch{}
    })();

    return()=>{mounted=false};
  },[router]);

  useEffect(()=>{setOpen(false)},[pathname]);

  async function logout(){
    await fetch('/api/admin/auth/logout',{method:'POST'});
    router.replace('/admin/login');
    router.refresh();
  }

  if(pathname==='/admin/login')return null;

  return <header className="admin-global-header">
    <div className="admin-header-inner">
      <Link href="/admin/dashboard" className="admin-brand">
        <span>ReChair</span>
        <small>ADMIN</small>
      </Link>

      <button
        className="admin-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-label="관리자 메뉴 열기"
        onClick={()=>setOpen(v=>!v)}
      >
        ☰
      </button>

      <nav className={open?'admin-nav open':'admin-nav'}>
        {menus.map(menu=>{
          const active=
            pathname===menu.href||
            (menu.href!=='/admin/dashboard'&&pathname.startsWith(menu.href+'/'));

          return <Link
            key={menu.href}
            href={menu.href}
            className={active?'active':''}
          >
            {menu.label}
          </Link>;
        })}
      </nav>

      <div className="admin-session-box">
        <div>
          <small>ADMIN SESSION</small>
          <b>{session?.role==='admin'?'관리자':'로그인 확인 중'}</b>
          {session?.expires_at&&
            <span>
              {new Date(session.expires_at).toLocaleTimeString('ko-KR',{
                hour:'2-digit',
                minute:'2-digit',
              })} 만료
            </span>}
        </div>

        <button type="button" onClick={logout}>로그아웃</button>
      </div>
    </div>
  </header>
}
