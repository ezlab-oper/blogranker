'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import AdminManagement from '@/views/AdminManagement';

export default function Page() {
  return (
    <ProtectedRoute requireAdminManagement>
      <AdminManagement />
    </ProtectedRoute>
  );
}
