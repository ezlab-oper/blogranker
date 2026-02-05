// API Request Tracker - tracks all Supabase API calls by feature
import { supabase } from '@/integrations/supabase/client';

// Feature categories for API tracking
export type ApiFeature = 
  | 'dashboard'
  | 'keywords'
  | 'results'
  | 'trends'
  | 'statistics'
  | 'settings'
  | 'usage'
  | 'scraping'
  | 'other';

// In-memory counter for current session
interface FeatureCounts {
  [key: string]: number;
}

class ApiTracker {
  private counts: FeatureCounts = {};
  private currentFeature: ApiFeature = 'other';
  private lastSyncTime: number = 0;
  private syncInterval: number = 30000; // Sync every 30 seconds
  private pendingSync: boolean = false;

  setCurrentFeature(feature: ApiFeature) {
    this.currentFeature = feature;
  }

  getCurrentFeature(): ApiFeature {
    return this.currentFeature;
  }

  trackRequest(feature?: ApiFeature) {
    const targetFeature = feature || this.currentFeature;
    this.counts[targetFeature] = (this.counts[targetFeature] || 0) + 1;
    
    // Auto-sync if interval passed
    const now = Date.now();
    if (now - this.lastSyncTime > this.syncInterval && !this.pendingSync) {
      this.syncToDatabase();
    }
  }

  getCounts(): FeatureCounts {
    return { ...this.counts };
  }

  getTotalCount(): number {
    return Object.values(this.counts).reduce((sum, count) => sum + count, 0);
  }

  async syncToDatabase(): Promise<void> {
    if (this.pendingSync || Object.keys(this.counts).length === 0) return;
    
    this.pendingSync = true;
    const countsToSync = { ...this.counts };
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get current day's log
      const { data: existingLog } = await supabase
        .from('usage_logs')
        .select('api_requests, api_requests_by_feature')
        .eq('date', today)
        .single();

      // Merge counts
      const existingFeatureCounts = (existingLog?.api_requests_by_feature as FeatureCounts) || {};
      const mergedCounts: FeatureCounts = { ...existingFeatureCounts };
      
      for (const [feature, count] of Object.entries(countsToSync)) {
        mergedCounts[feature] = (mergedCounts[feature] || 0) + count;
      }

      const totalApiRequests = Object.values(mergedCounts).reduce((sum, count) => sum + count, 0);

      // Upsert the log
      await supabase
        .from('usage_logs')
        .upsert({
          date: today,
          api_requests: totalApiRequests,
          api_requests_by_feature: mergedCounts,
        }, { onConflict: 'date' });

      // Clear synced counts
      this.counts = {};
      this.lastSyncTime = Date.now();
    } catch (error) {
      console.error('Failed to sync API counts:', error);
    } finally {
      this.pendingSync = false;
    }
  }

  // Force sync before page unload
  forceSync() {
    if (Object.keys(this.counts).length > 0) {
      // Use sendBeacon for reliable sync on page unload
      const today = new Date().toISOString().split('T')[0];
      const payload = {
        date: today,
        counts: this.counts,
      };
      
      // Fallback to regular sync
      this.syncToDatabase();
    }
  }
}

export const apiTracker = new ApiTracker();

// Sync on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    apiTracker.forceSync();
  });
  
  // Also sync periodically
  setInterval(() => {
    apiTracker.syncToDatabase();
  }, 30000);
}
