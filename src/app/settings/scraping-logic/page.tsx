'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import ScrapingLogicMap from '@/views/ScrapingLogicMap';

export default function Page() {
  return (
    <ProtectedRoute requireSettings>
      <ScrapingLogicMap />
    </ProtectedRoute>
  );
}
