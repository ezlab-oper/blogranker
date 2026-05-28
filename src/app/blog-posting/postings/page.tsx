'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import PostingsList from '@/views/PostingsList';

export default function Page() {
  return (
    <ProtectedRoute>
      <PostingsList />
    </ProtectedRoute>
  );
}
