'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSettings?: boolean;
  requireAdminManagement?: boolean;
  requireFeatures?: boolean;
}

export function ProtectedRoute({
  children,
  requireSettings = false,
  requireAdminManagement = false,
  requireFeatures = false,
}: ProtectedRouteProps) {
  const { user, role, isLoading, canAccessSettings, canManageAdmins, canUseFeatures } = useAuth();
  const router = useRouter();

  // 인증/권한 판정 (로딩 중에는 판정 보류)
  const notAuthed = !isLoading && (!user || !role);
  const lacksSettings = !isLoading && requireSettings && !canAccessSettings;
  const lacksAdmin = !isLoading && requireAdminManagement && !canManageAdmins;
  const lacksFeatures = !isLoading && requireFeatures && !canUseFeatures;
  const blocked = notAuthed || lacksSettings || lacksAdmin || lacksFeatures;

  useEffect(() => {
    if (notAuthed) {
      router.replace('/login');
    } else if (lacksSettings || lacksAdmin || lacksFeatures) {
      router.replace('/');
    }
  }, [notAuthed, lacksSettings, lacksAdmin, lacksFeatures, router]);

  // 로딩 중이거나 리다이렉트 대기 중에는 children을 노출하지 않는다
  if (isLoading || blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
