'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import BloggersList from '@/views/BloggersList';

export default function Page() {
  return (
    <ProtectedRoute>
      <BloggersList />
    </ProtectedRoute>
  );
}
