'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import CollabRequests from '@/views/CollabRequests';

export default function Page() {
  return (
    <ProtectedRoute>
      <CollabRequests />
    </ProtectedRoute>
  );
}
