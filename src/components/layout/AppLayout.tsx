import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        {/* 콘텐츠 영역: 사이드바를 제외한 가용폭 전체 사용.
            작은 화면은 px-4, lg 이상은 px-6, 2xl 이상은 px-10. 가로 제한 없음. */}
        <div className="w-full py-6 px-4 lg:px-6 2xl:px-10">
          {children}
        </div>
      </main>
    </div>
  );
}