import type { Metadata } from 'next';
import '@/index.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '블로그 랭크 트래커',
  description: '네이버 통합검색 블로그 순위 추적 관리자 도구',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
