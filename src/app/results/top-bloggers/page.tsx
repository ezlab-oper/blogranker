'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import TopBloggers from '@/views/TopBloggers';

export default function Page() {
  return (
    <ProtectedRoute requireFeatures>
      <TopBloggers />
    </ProtectedRoute>
  );
}
