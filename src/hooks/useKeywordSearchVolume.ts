import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface KeywordSearchVolume {
  relKeyword: string;
  monthlyPcQcCnt: number | string;
  monthlyMobileQcCnt: number | string;
  monthlyAvePcClkCnt?: number;
  monthlyAveMobileClkCnt?: number;
  monthlyAvePcCtr?: number;
  monthlyAveMobileCtr?: number;
  plAvgDepth?: number;
  compIdx?: string;
}

interface NaverKeywordResponse {
  keywordList: KeywordSearchVolume[];
}

export interface VolumeMap {
  fetchedAt: string;
  byKeyword: Record<string, KeywordSearchVolume>;
}

const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();

// queryKey 안정화용 — 같은 키워드 집합이면 순서 관계없이 같은 키
function keywordsSignature(keywords: string[]): string {
  return [...new Set(keywords.map(normalize))].sort().join('|');
}

async function fetchVolumes(keywords: string[]): Promise<VolumeMap> {
  if (keywords.length === 0) return { fetchedAt: new Date().toISOString(), byKeyword: {} };

  // 네이버 광고 API는 1회 최대 5개
  const batchSize = 5;
  const allResults: KeywordSearchVolume[] = [];
  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    const { data: result, error } = await supabase.functions.invoke('naver-keyword-search', {
      body: { keywords: batch },
    });
    if (error) throw error;
    const response = result as NaverKeywordResponse;
    if (response?.keywordList) allResults.push(...response.keywordList);
  }

  // 정규화로 매칭
  const normalizedKeywords = keywords.map((k) => normalize(k));
  const byKeyword: Record<string, KeywordSearchVolume> = {};
  for (const item of allResults) {
    const idx = normalizedKeywords.indexOf(normalize(item.relKeyword));
    if (idx !== -1) byKeyword[keywords[idx].toLowerCase()] = item;
  }
  return { fetchedAt: new Date().toISOString(), byKeyword };
}

/**
 * 키워드 월간 검색량 조회 (React Query 캐시 공유).
 * - keywords 배열을 주면 자동 fetch.
 * - 같은 키워드 집합은 페이지 간 캐시 공유 (Keywords·ResultsTable 모두 동일 데이터 사용).
 * - 캐시 staleTime 30분.
 */
export function useKeywordSearchVolume(keywords?: string[]) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sig = keywords ? keywordsSignature(keywords) : '';

  const query = useQuery({
    queryKey: ['search-volume', sig],
    enabled: !!keywords && keywords.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    queryFn: () => fetchVolumes(keywords!),
  });

  const getVolume = useCallback(
    (kw: string): KeywordSearchVolume | undefined => query.data?.byKeyword?.[kw.toLowerCase()],
    [query.data]
  );

  // 명시적 재조회 — Keywords 페이지의 "검색량 조회" 버튼이 호출.
  const fetchSearchVolume = useCallback(async (kws: string[]) => {
    if (kws.length === 0) return;
    const newSig = keywordsSignature(kws);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['search-volume', newSig],
        queryFn: () => fetchVolumes(kws),
        staleTime: 0, // 강제 새로고침
      });
      queryClient.setQueryData(['search-volume', newSig], data);
      toast({ title: '검색량 데이터를 불러왔습니다.' });
    } catch (e) {
      toast({
        title: '검색량 조회 실패',
        description: e instanceof Error ? e.message : '오류',
        variant: 'destructive',
      });
    }
  }, [queryClient, toast]);

  return {
    data: query.data?.byKeyword ?? {},
    isLoading: query.isLoading || query.isFetching,
    fetchedAt: query.data?.fetchedAt ? new Date(query.data.fetchedAt) : null,
    fetchSearchVolume,
    getVolume,
  };
}
