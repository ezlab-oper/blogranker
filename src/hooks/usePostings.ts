import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { extractBlogId } from '@/hooks/useBlogUrls';
import type { Blogger } from '@/hooks/useBloggers';

export interface Posting {
  id: string;
  blogger_id: string | null;
  posting_url: string;
  blog_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  blogger?: Blogger | null; // join
}

export interface PostingInput {
  posting_url: string;
  blogger_id?: string | null;
  title?: string | null;
  blog_id?: string | null;
}

export function usePostings() {
  return useQuery({
    queryKey: ['postings'],
    queryFn: async (): Promise<Posting[]> => {
      const { data, error } = await supabase
        .from('postings')
        .select('*, blogger:bloggers(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Posting[]) || [];
    },
  });
}

// URL로부터 blog_id 추출 후 동일 blog_id를 가진 블로거를 찾아 반환
export async function findBloggerByUrl(url: string): Promise<Blogger | null> {
  const blogId = extractBlogId(url);
  if (!blogId) return null;
  const { data, error } = await supabase
    .from('bloggers').select('*').eq('blog_id', blogId).maybeSingle();
  if (error) return null;
  return (data as Blogger) || null;
}

export function useAddPosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PostingInput) => {
      const blog_id = input.blog_id ?? extractBlogId(input.posting_url);
      const row = { ...input, blog_id };
      const { data, error } = await supabase.from('postings').insert(row).select().single();
      if (error) throw error;
      return data as Posting;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postings'] }),
  });
}

export function useUpdatePosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PostingInput> }) => {
      const next = { ...patch };
      if (patch.posting_url !== undefined) next.blog_id = extractBlogId(patch.posting_url);
      const { data, error } = await supabase.from('postings').update(next).eq('id', id).select().single();
      if (error) throw error;
      return data as Posting;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postings'] }),
  });
}

export function useDeletePosting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('postings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postings'] }),
  });
}

// 특정 포스팅 URL이 키워드별로 어떤 순위에 들었는지 (기간 N일 내)
// m.blog ↔ blog 정규화 + 쿼리 파라미터 무시까지 시도해 매칭 폭을 넓힌다.
export interface PostingRankRow {
  crawled_at: string;
  rank: number;
  keyword: string | null;
  engine: string | null;
}

function urlVariants(url: string): string[] {
  const set = new Set<string>([url]);
  try {
    const u = new URL(url);
    // 쿼리 제거
    const noQuery = `${u.protocol}//${u.host}${u.pathname}`;
    set.add(noQuery);
    // m.blog ↔ blog 변환
    if (u.host === 'm.blog.naver.com') {
      set.add(noQuery.replace('m.blog.naver.com', 'blog.naver.com'));
    } else if (u.host === 'blog.naver.com') {
      set.add(noQuery.replace('blog.naver.com', 'm.blog.naver.com'));
    }
    // 원본의 m↔blog 변환도
    set.add(url.replace('m.blog.naver.com', 'blog.naver.com'));
    set.add(url.replace('blog.naver.com', 'm.blog.naver.com'));
  } catch {
    // ignore
  }
  return Array.from(set);
}

export function usePostingRankHistory(url: string | null, days: number) {
  return useQuery({
    queryKey: ['posting_rank_history', url, days],
    enabled: !!url,
    queryFn: async (): Promise<PostingRankRow[]> => {
      if (!url) return [];
      const variants = urlVariants(url);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      const { data, error } = await supabase
        .from('crawl_results')
        .select('crawled_at, rank, keyword:keywords(keyword), search_engine:search_engines(name)')
        .in('blog_url', variants)
        .gte('crawled_at', fromDate.toISOString())
        .order('crawled_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        crawled_at: r.crawled_at,
        rank: r.rank,
        keyword: r.keyword?.keyword ?? null,
        engine: r.search_engine?.name ?? null,
      }));
    },
  });
}
