import './globals.css';
import Header from '@/components/Header';
import ScrollToTopOnLoad from '@/components/ScrollToTopOnLoad';

export const metadata = { title: 'ReChair', description: '중고 안마의자 통합 서비스 플랫폼' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <ScrollToTopOnLoad />
        <Header />
        {children}
      </body>
    </html>
  );
}
