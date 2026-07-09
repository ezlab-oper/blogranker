import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EngineStats {
  engine_name: string;
  total_results: number;
  avg_rank: number;
}

export interface PlatformStats {
  platform: string;
  count: number;
}

export interface DailyStats {
  date: string;
  naver_count: number;
  google_count: number;
  total: number;
}

export interface RankDistribution {
  range: string;
  count: number;
}

export interface JobStats {
  total_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  running_jobs: number;
  cancelled_jobs: number;
  success_rate: number;
}

export interface OverviewStats {
  total_results: number;
  total_keywords: number;
  avg_rank: number;
  top3_count: number;
  engines_active: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export function useStatistics(dateRange?: DateRange) {
  const fromDate = dateRange?.from?.toISOString();
  const toDate = dateRange?.to ? new Date(dateRange.to.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : undefined;

  // Overview stats
  const overviewQuery = useQuery({
    queryKey: ['statistics', 'overview', fromDate, toDate],
    queryFn: async (): Promise<OverviewStats> => {
      let resultsQuery = supabase.from('crawl_results').select('rank', { count: 'exact' }).eq('is_ai_briefing', false);
      
      if (fromDate) {
        resultsQuery = resultsQuery.gte('crawled_at', fromDate);
      }
      if (toDate) {
        resultsQuery = resultsQuery.lte('crawled_at', toDate);
      }

      const [resultsRes, keywordsRes, enginesRes] = await Promise.all([
        resultsQuery,
        supabase.from('keywords').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('search_engines').select('id', { count: 'exact' }).eq('is_active', true),
      ]);

      const results = resultsRes.data || [];
      const totalResults = resultsRes.count || 0;
      const totalKeywords = keywordsRes.count || 0;
      const enginesActive = enginesRes.count || 0;

      const avgRank = results.length > 0
        ? results.reduce((sum, r) => sum + r.rank, 0) / results.length
        : 0;

      const top3Count = results.filter(r => r.rank <= 3).length;

      return {
        total_results: totalResults,
        total_keywords: totalKeywords,
        avg_rank: Math.round(avgRank * 10) / 10,
        top3_count: top3Count,
        engines_active: enginesActive,
      };
    },
  });

  // Engine stats
  const engineStatsQuery = useQuery({
    queryKey: ['statistics', 'engines', fromDate, toDate],
    queryFn: async (): Promise<EngineStats[]> => {
      const { data: engines } = await supabase
        .from('search_engines')
        .select('id, name');

      if (!engines) return [];

      const stats: EngineStats[] = [];

      for (const engine of engines) {
        let query = supabase
          .from('crawl_results')
          .select('rank')
          .eq('is_ai_briefing', false)
          .eq('search_engine_id', engine.id);

        if (fromDate) {
          query = query.gte('crawled_at', fromDate);
        }
        if (toDate) {
          query = query.lte('crawled_at', toDate);
        }

        const { data: results } = await query;

        if (results && results.length > 0) {
          const avgRank = results.reduce((sum, r) => sum + r.rank, 0) / results.length;
          stats.push({
            engine_name: engine.name,
            total_results: results.length,
            avg_rank: Math.round(avgRank * 10) / 10,
          });
        }
      }

      return stats;
    },
  });

  // Platform stats
  const platformStatsQuery = useQuery({
    queryKey: ['statistics', 'platforms', fromDate, toDate],
    queryFn: async (): Promise<PlatformStats[]> => {
      let query = supabase.from('crawl_results').select('blog_platform').eq('is_ai_briefing', false).limit(50000);

      if (fromDate) {
        query = query.gte('crawled_at', fromDate);
      }
      if (toDate) {
        query = query.lte('crawled_at', toDate);
      }

      const { data } = await query;

      if (!data) return [];

      const platformCounts: Record<string, number> = {};
      data.forEach(r => {
        const platform = r.blog_platform || '기타';
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });

      return Object.entries(platformCounts)
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  // Daily stats
  const dailyStatsQuery = useQuery({
    queryKey: ['statistics', 'daily', fromDate, toDate],
    queryFn: async (): Promise<DailyStats[]> => {
      let query = supabase.from('crawl_results').select('crawled_at, search_engine_id').eq('is_ai_briefing', false).limit(50000);

      if (fromDate) {
        query = query.gte('crawled_at', fromDate);
      }
      if (toDate) {
        query = query.lte('crawled_at', toDate);
      }

      const { data: results } = await query;
      const { data: engines } = await supabase.from('search_engines').select('id, name');

      if (!results || !engines) return [];

      // DB 엔진 이름은 한글 '네이버'/'구글'. 영문도 보조로 허용.
      const matchEngine = (name: string, target: 'naver' | 'google') => {
        const lower = name.toLowerCase();
        return target === 'naver'
          ? (name === '네이버' || lower.includes('naver'))
          : (name === '구글' || lower.includes('google'));
      };
      const naverEngineId = engines.find(e => matchEngine(e.name, 'naver'))?.id;
      const googleEngineId = engines.find(e => matchEngine(e.name, 'google'))?.id;

      const dailyCounts: Record<string, { naver: number; google: number }> = {};

      results.forEach(r => {
        const date = new Date(r.crawled_at).toISOString().split('T')[0];
        if (!dailyCounts[date]) {
          dailyCounts[date] = { naver: 0, google: 0 };
        }
        if (r.search_engine_id === naverEngineId) {
          dailyCounts[date].naver++;
        } else if (r.search_engine_id === googleEngineId) {
          dailyCounts[date].google++;
        }
      });

      return Object.entries(dailyCounts)
        .map(([date, counts]) => ({
          date,
          naver_count: counts.naver,
          google_count: counts.google,
          total: counts.naver + counts.google,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  // Rank distribution
  const rankDistributionQuery = useQuery({
    queryKey: ['statistics', 'rankDistribution', fromDate, toDate],
    queryFn: async (): Promise<RankDistribution[]> => {
      let query = supabase.from('crawl_results').select('rank').eq('is_ai_briefing', false).limit(50000);

      if (fromDate) {
        query = query.gte('crawled_at', fromDate);
      }
      if (toDate) {
        query = query.lte('crawled_at', toDate);
      }

      const { data } = await query;

      if (!data) return [];

      const ranges = [
        { range: '1-3위', min: 1, max: 3 },
        { range: '4-6위', min: 4, max: 6 },
        { range: '7-10위', min: 7, max: 10 },
      ];

      return ranges.map(r => ({
        range: r.range,
        count: data.filter(d => d.rank >= r.min && d.rank <= r.max).length,
      }));
    },
  });

  // Job stats
  const jobStatsQuery = useQuery({
    queryKey: ['statistics', 'jobs', fromDate, toDate],
    queryFn: async (): Promise<JobStats> => {
      let query = supabase.from('crawl_jobs').select('status, successful_keywords, failed_keywords, created_at').limit(50000);

      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }
      if (toDate) {
        query = query.lte('created_at', toDate);
      }

      const { data } = await query;

      if (!data || data.length === 0) {
        return {
          total_jobs: 0,
          successful_jobs: 0,
          failed_jobs: 0,
          running_jobs: 0,
          cancelled_jobs: 0,
          success_rate: 0,
        };
      }

      const totalJobs = data.length;
      const successfulJobs = data.filter(j => j.status === 'completed').length;
      const failedJobs = data.filter(j => j.status === 'failed').length;
      const cancelledJobs = data.filter(j => j.status === 'cancelled').length;
      // running/pending 상태이면서 1시간 이상 지난 작업은 stale로 간주하고 제외
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const runningJobs = data.filter(j => 
        (j.status === 'running' || j.status === 'pending') && 
        j.created_at > oneHourAgo
      ).length;

      // 성공률은 완료된 작업(성공+실패) 중 성공한 비율로 계산 (취소된 작업은 제외)
      const completedJobs = successfulJobs + failedJobs;
      const successRate = completedJobs > 0 ? Math.round((successfulJobs / completedJobs) * 100) : 0;

      return {
        total_jobs: totalJobs,
        successful_jobs: successfulJobs,
        failed_jobs: failedJobs,
        running_jobs: runningJobs,
        cancelled_jobs: cancelledJobs,
        success_rate: successRate,
      };
    },
  });

  return {
    overview: overviewQuery.data,
    engineStats: engineStatsQuery.data || [],
    platformStats: platformStatsQuery.data || [],
    dailyStats: dailyStatsQuery.data || [],
    rankDistribution: rankDistributionQuery.data || [],
    jobStats: jobStatsQuery.data,
    isLoading:
      overviewQuery.isLoading ||
      engineStatsQuery.isLoading ||
      platformStatsQuery.isLoading ||
      dailyStatsQuery.isLoading ||
      rankDistributionQuery.isLoading ||
      jobStatsQuery.isLoading,
  };
}
