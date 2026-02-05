import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CrawlResult, SearchEngine, DashboardStats } from '@/types/database';

export function useSearchEngines() {
  return useQuery({
    queryKey: ['search_engines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('search_engines')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as SearchEngine[];
    },
  });
}

export function useCrawlResults(filters?: {
  keyword_id?: string;
  search_engine_id?: string;
  date_from?: string;
  date_to?: string;
}) {
  return useQuery({
    queryKey: ['crawl_results', filters],
    queryFn: async () => {
      let query = supabase
        .from('crawl_results')
        .select(`
          *,
          keyword:keywords(*),
          search_engine:search_engines(*)
        `)
        .order('crawled_at', { ascending: false })
        .limit(500);

      if (filters?.keyword_id) {
        query = query.eq('keyword_id', filters.keyword_id);
      }
      if (filters?.search_engine_id) {
        query = query.eq('search_engine_id', filters.search_engine_id);
      }
      if (filters?.date_from) {
        query = query.gte('crawled_at', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('crawled_at', filters.date_to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CrawlResult[];
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [keywordsRes, resultsRes, todayRes] = await Promise.all([
        supabase.from('keywords').select('id, is_active'),
        supabase.from('crawl_results').select('crawled_at').order('crawled_at', { ascending: false }).limit(1),
        supabase.from('crawl_results').select('id').gte('crawled_at', today),
      ]);

      const keywords = keywordsRes.data || [];
      const lastResult = resultsRes.data?.[0];
      const todayResults = todayRes.data || [];

      // Get total results count
      const { count } = await supabase
        .from('crawl_results')
        .select('*', { count: 'exact', head: true });

      return {
        totalKeywords: keywords.length,
        activeKeywords: keywords.filter(k => k.is_active).length,
        totalResults: count || 0,
        lastCrawlDate: lastResult?.crawled_at || null,
        todayResults: todayResults.length,
      } as DashboardStats;
    },
  });
}