import {Suspense} from 'react';
import AdminLoginForm from '@/components/AdminLoginForm';
import './login.css';
export default function Page(){
  return <main className="admin-login-page">
    <Suspense fallback={<div>로그인 화면을 불러오는 중입니다.</div>}><AdminLoginForm/></Suspense>
  </main>;
}
