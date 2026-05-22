'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Usage from '@/views/Usage';

export default function Page() {
  return (
    <ProtectedRoute>
      <Usage />
    </ProtectedRoute>
  );
}
