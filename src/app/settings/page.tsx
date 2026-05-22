'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Settings from '@/views/Settings';

export default function Page() {
  return (
    <ProtectedRoute requireSettings>
      <Settings />
    </ProtectedRoute>
  );
}
