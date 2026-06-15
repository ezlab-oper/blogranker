import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Period = 7 | 14 | 30;
export const ALL_PROGRAMS = '__ALL__';

export interface TopExternalBlogger {
  period_days: Period;
  blog_id: string;
  program: string;            // '__ALL__' | '미지정' | program 이름
  author_name: string | null;
  platform: string | null;
  hit_keywords: string[];
  hit_keyword_count: number;
  total_appearances: number;
  best_rank: number;
  avg_rank: number;
  engines: string[];
  last_seen_at: string;
  sample_post_url: string | null;
  computed_at: string;
}

export interface TopExternalBloggersFilters {
  period: Period;                 // 7 / 14 / 30
  program?: string;               // 미지정 시 '__ALL__'
  engine?: string;                // '네이버' | '구글' (engines 배열 포함 여부)
  keyword?: string;               // hit_keywords 배열에 포함되는지
  minKeywordCount?: number;       // 기본 2
}

export function useTopExternalBloggers(filters: TopExternalBloggersFilters) {
  const program = filters.program || ALL_PROGRAMS;
  const minCount = filters.minKeywordCount ?? 2;

  return useQuery({
    queryKey: [
      'top_external_bloggers',
      filters.period,
      program,
      filters.engine ?? null,
      filters.keyword ?? null,
      minCount,
    ],
    queryFn: async (): Promise<TopExternalBlogger[]> => {
      let q = supabase
        .from('top_external_bloggers')
        .select('*')
        .eq('period_days', filters.period)
        .eq('program', program)
        .gte('hit_keyword_count', minCount)
        .order('hit_keyword_count', { ascending: false })
        .order('avg_rank', { ascending: true })
        .limit(2000);

      // 엔진은 배열 contains
      if (filters.engine) {
        q = q.contains('engines', [filters.engine]);
      }
      // 키워드는 hit_keywords 배열 contains
      if (filters.keyword) {
        q = q.contains('hit_keywords', [filters.keyword]);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as TopExternalBlogger[]) || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

// 모든 외부 블로거 풀(필터 미적용) 카운트 — "전체 47명 중" 표시용
export function useTopExternalBloggersTotal(period: Period, program: string = ALL_PROGRAMS) {
  return useQuery({
    queryKey: ['top_external_bloggers_total', period, program],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('top_external_bloggers')
        .select('*', { count: 'exact', head: true })
        .eq('period_days', period)
        .eq('program', program);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// 가장 최근 갱신 시각 (페이지 헤더에 노출)
export function useTopBloggersComputedAt() {
  return useQuery({
    queryKey: ['top_external_bloggers_computed_at'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('top_external_bloggers')
        .select('computed_at')
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.computed_at ?? null;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// program 옵션으로 노출할 program 리스트 — DB에 실제 존재하는 것 + 미지정 합쳐 반환.
// (Settings의 programs와 다를 수 있어 별도 조회: 사전 집계에 실제 등장한 program만 옵션화)
export function useAvailableProgramsInTopBloggers(period: Period) {
  return useQuery({
    queryKey: ['top_external_bloggers_programs', period],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('top_external_bloggers')
        .select('program')
        .eq('period_days', period);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r) => set.add((r as { program: string }).program));
      set.delete(ALL_PROGRAMS);
      return Array.from(set).sort();
    },
    staleTime: 1000 * 60 * 10,
  });
}
