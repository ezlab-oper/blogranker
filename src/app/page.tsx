'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Dashboard from '@/views/Dashboard';

export default function Page() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
