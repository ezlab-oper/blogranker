import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { apiTracker } from '@/lib/api-tracker';

export interface UsageLog {
  id: string;
  date: string;
  database_rows: number;
  database_size_mb: number;
  storage_size_mb: number;
  edge_function_invocations: number;
  api_requests: number;
  api_requests_by_feature: Record<string, number> | null;
  bandwidth_mb: number;
  created_at: string;
  updated_at: string;
}

export interface TableStat {
  table_name: string;
  row_count: number;
  size_bytes: number;
}

export interface UsageData {
  success: boolean;
  today: UsageLog;
  cumulative: {
    total_edge_invocations: number;
    total_api_requests: number;
  };
  table_stats: TableStat[];
}

export function useUsageLogs(days: number = 30) {
  return useQuery({
    queryKey: ['usage_logs', days],
    queryFn: async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .gte('date', fromDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      return data as UsageLog[];
    },
  });
}

export function useTodayUsage() {
  return useQuery({
    queryKey: ['usage_today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data as UsageLog | null;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useCollectUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<UsageData> => {
      // Sync any pending API counts before collecting
      await apiTracker.syncToDatabase();
      
      const featureCounts = apiTracker.getCounts();
      
      const { data, error } = await supabase.functions.invoke('collect-usage', {
        body: { featureCounts },
      });

      if (error) throw error;
      return data as UsageData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage_logs'] });
      queryClient.invalidateQueries({ queryKey: ['usage_today'] });
      queryClient.invalidateQueries({ queryKey: ['cumulative_stats'] });
    },
  });
}

export function useCumulativeStats() {
  return useQuery({
    queryKey: ['cumulative_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      const logs = data as UsageLog[];

      // Aggregate feature counts across all days
      const featureBreakdown: Record<string, number> = {};
      logs.forEach(log => {
        const featureCounts = log.api_requests_by_feature || {};
        Object.entries(featureCounts).forEach(([feature, count]) => {
          featureBreakdown[feature] = (featureBreakdown[feature] || 0) + count;
        });
      });

      return {
        totalEdgeInvocations: logs.reduce(
          (sum, log) => sum + (log.edge_function_invocations || 0),
          0
        ),
        totalApiRequests: logs.reduce(
          (sum, log) => sum + (log.api_requests || 0),
          0
        ),
        currentDatabaseRows: logs[0]?.database_rows || 0,
        currentDatabaseSizeMb: logs[0]?.database_size_mb || 0,
        currentStorageSizeMb: logs[0]?.storage_size_mb || 0,
        lastUpdated: logs[0]?.updated_at || null,
        featureBreakdown,
      };
    },
  });
}