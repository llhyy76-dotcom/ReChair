import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReChair | 중고 안마의자 전문 플랫폼',
  description: '중고 안마의자 구매, 판매, 이전설치, 폐기수거, 출장수리, 부품구매까지 한 번에 해결하는 ReChair입니다.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
