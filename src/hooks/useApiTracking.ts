import { useEffect } from 'react';
import { apiTracker, ApiFeature } from '@/lib/api-tracker';

// Hook to set the current feature context for API tracking
export function useApiTracking(feature: ApiFeature) {
  useEffect(() => {
    apiTracker.setCurrentFeature(feature);
    
    return () => {
      // Reset to 'other' when leaving the page
      apiTracker.setCurrentFeature('other');
    };
  }, [feature]);
}

// Export the tracker for manual tracking
export { apiTracker, type ApiFeature } from '@/lib/api-tracker';
