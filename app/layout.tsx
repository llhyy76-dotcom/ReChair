import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'ReChair', description: '중고 안마의자 구매·판매·수리 통합 플랫폼' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
