import { Navigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user || !role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check permissions
  if (requireSettings && !canAccessSettings) {
    return <Navigate to="/" replace />;
  }

  if (requireAdminManagement && !canManageAdmins) {
    return <Navigate to="/" replace />;
  }

  if (requireFeatures && !canUseFeatures) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
