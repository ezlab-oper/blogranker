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
  latestOnly?: boolean;
  // KST 기준 YYYY-MM-DD. 지정 시 그날 0시~익일 0시(KST) 범위로 서버에서 필터.
  crawl_date?: string;
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
        .limit(2000);

      if (filters?.keyword_id) {
        query = query.eq('keyword_id', filters.keyword_id);
      }

      if (filters?.crawl_date) {
        // KST 자정 → UTC ISO. KST = UTC+9.
        const [y, m, d] = filters.crawl_date.split('-').map(Number);
        const startUtcMs = Date.UTC(y, m - 1, d, -9, 0, 0);
        const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
        query = query
          .gte('crawled_at', new Date(startUtcMs).toISOString())
          .lt('crawled_at', new Date(endUtcMs).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = data as CrawlResult[];

      // Filter out inactive keywords
      results = results.filter(r => r.keyword?.is_active !== false);

      // Filter out AI briefing / naver internal URLs on the frontend
      results = results.filter(r => {
        if (r.blog_url.includes('m.search.naver.com') || r.blog_url.includes('search.naver.com')) return false;
        if (r.blog_title.includes('AI 브리핑') || r.blog_title.includes('AI 답변')) return false;
        return true;
      });

      // Keep only the latest crawl batch per keyword
      if (filters?.latestOnly !== false) {
        // Group by keyword_id, find the max crawled_at per keyword, then keep only results from that batch
        const latestByKeyword = new Map<string, string>();
        for (const r of results) {
          const existing = latestByKeyword.get(r.keyword_id);
          if (!existing || r.crawled_at > existing) {
            latestByKeyword.set(r.keyword_id, r.crawled_at);
          }
        }
        // Keep results within 60 seconds of the latest crawl per keyword (same batch)
        results = results.filter(r => {
          const latest = latestByKeyword.get(r.keyword_id);
          if (!latest) return false;
          const diff = new Date(latest).getTime() - new Date(r.crawled_at).getTime();
          return diff < 60000; // within 1 minute = same batch
        });
      }

      return results;
    },
  });
}

// 진행 중인 crawl_job (60분 이내 시작한 running) — 동시 실행 방지용. 5초 폴링.
export function useRunningCrawlJob() {
  return useQuery({
    queryKey: ['running_crawl_job'],
    queryFn: async () => {
      const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('crawl_jobs')
        .select('id, started_at, total_keywords, processed_keywords')
        .eq('status', 'running')
        .gte('started_at', sixtyMinAgo)
        .order('started_at', { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
    refetchInterval: 5000,
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