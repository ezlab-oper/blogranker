'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import CollaborationCompose from '@/views/CollaborationCompose';

export default function Page() {
  return (
    <ProtectedRoute requireFeatures>
      <CollaborationCompose />
    </ProtectedRoute>
  );
}
