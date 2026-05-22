'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Trends from '@/views/Trends';

export default function Page() {
  return (
    <ProtectedRoute>
      <Trends />
    </ProtectedRoute>
  );
}
