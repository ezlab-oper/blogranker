import { useState } from 'react';
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

export function useKeywordSearchVolume() {
  const [data, setData] = useState<Record<string, KeywordSearchVolume>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchSearchVolume = async (keywords: string[]) => {
    if (keywords.length === 0) return;

    setIsLoading(true);
    try {
      // Naver API allows max 5 keywords per request
      const batchSize = 5;
      const allResults: KeywordSearchVolume[] = [];

      for (let i = 0; i < keywords.length; i += batchSize) {
        const batch = keywords.slice(i, i + batchSize);
        const { data: result, error } = await supabase.functions.invoke('naver-keyword-search', {
          body: { keywords: batch },
        });

        if (error) throw error;

        const response = result as NaverKeywordResponse;
        if (response?.keywordList) {
          allResults.push(...response.keywordList);
        }
      }

      // Map by keyword (exact match)
      const volumeMap: Record<string, KeywordSearchVolume> = {};
      const lowerKeywords = keywords.map(k => k.toLowerCase());

      for (const item of allResults) {
        if (lowerKeywords.includes(item.relKeyword.toLowerCase())) {
          volumeMap[item.relKeyword.toLowerCase()] = item;
        }
      }

      setData(volumeMap);
      toast({ title: '검색량 데이터를 불러왔습니다.' });
    } catch (error: any) {
      console.error('Search volume fetch error:', error);
      toast({
        title: '검색량 조회 실패',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getVolume = (keyword: string): KeywordSearchVolume | undefined => {
    return data[keyword.toLowerCase()];
  };

  return { data, isLoading, fetchSearchVolume, getVolume };
}
