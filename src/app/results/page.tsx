'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Results from '@/views/Results';

export default function Page() {
  return (
    <ProtectedRoute requireFeatures>
      <Results />
    </ProtectedRoute>
  );
}
