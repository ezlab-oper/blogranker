'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Statistics from '@/views/Statistics';

export default function Page() {
  return (
    <ProtectedRoute>
      <Statistics />
    </ProtectedRoute>
  );
}
