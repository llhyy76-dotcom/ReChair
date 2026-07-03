import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReChair | 중고 안마의자 플랫폼',
  description: '중고 안마의자 구매, 판매, 이전설치, 수리, 폐기수거 상담 플랫폼'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
