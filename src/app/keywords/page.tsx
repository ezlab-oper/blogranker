'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Keywords from '@/views/Keywords';

export default function Page() {
  return (
    <ProtectedRoute requireFeatures>
      <Keywords />
    </ProtectedRoute>
  );
}
