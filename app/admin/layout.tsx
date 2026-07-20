import type {ReactNode} from 'react';
import AdminHeader from '@/components/AdminHeader';
import './admin-layout.css';

export default function AdminLayout({
  children,
}:{
  children:ReactNode;
}){
  return <>
    <AdminHeader/>
    <div className="admin-layout-content">
      {children}
    </div>
  </>;
}
