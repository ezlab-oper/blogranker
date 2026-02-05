 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 
 export interface UsageLog {
   id: string;
   date: string;
   database_rows: number;
   database_size_mb: number;
   storage_size_mb: number;
   edge_function_invocations: number;
   api_requests: number;
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
 
 export function useCollectUsage() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (): Promise<UsageData> => {
       const { data, error } = await supabase.functions.invoke('collect-usage');
 
       if (error) throw error;
       return data as UsageData;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['usage_logs'] });
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
       };
     },
   });
 }