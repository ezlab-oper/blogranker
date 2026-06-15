import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { extractBlogId } from '@/hooks/useBlogUrls';

export type BloggerStatus = '협업 요청' | '협업 거절' | '계약됨' | '계약만료';
export type BlogGrade =
  | '최적화3' | '최적화2' | '최적화1'
  | '준최적6' | '준최적5' | '준최적4' | '준최적3' | '준최적2' | '준최적1'
  | '일반' | '저품질';

export const BLOGGER_STATUS_OPTIONS: BloggerStatus[] = [
  '협업 요청', '협업 거절', '계약됨', '계약만료',
];

export const BLOG_GRADE_OPTIONS: BlogGrade[] = [
  '최적화3', '최적화2', '최적화1',
  '준최적6', '준최적5', '준최적4', '준최적3', '준최적2', '준최적1',
  '일반', '저품질',
];

export interface Blogger {
  id: string;
  name: string;
  blog_url: string;
  blog_id: string | null;
  email: string | null;
  unit_price: number | null;
  status: BloggerStatus | null;
  contract_end_date: string | null; // YYYY-MM-DD
  blog_grade: BlogGrade | null;
  is_influencer: boolean;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export type BloggerInput = Omit<Blogger, 'id' | 'created_at' | 'updated_at' | 'blog_id'> & {
  blog_id?: string | null;
};

export function useBloggers() {
  return useQuery({
    queryKey: ['bloggers'],
    queryFn: async (): Promise<Blogger[]> => {
      const { data, error } = await supabase
        .from('bloggers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Blogger[]) || [];
    },
  });
}

export function useAddBlogger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BloggerInput) => {
      const row = { ...input, blog_id: input.blog_id ?? extractBlogId(input.blog_url) };
      const { data, error } = await supabase.from('bloggers').insert(row).select().single();
      if (error) throw error;
      return data as Blogger;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloggers'] }),
  });
}

export function useUpdateBlogger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<BloggerInput> }) => {
      const next = { ...patch };
      if (patch.blog_url !== undefined) next.blog_id = extractBlogId(patch.blog_url);
      const { data, error } = await supabase
        .from('bloggers').update(next).eq('id', id).select().single();
      if (error) throw error;
      return data as Blogger;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bloggers'] });
      qc.invalidateQueries({ queryKey: ['postings'] });
    },
  });
}

export function useDeleteBlogger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bloggers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bloggers'] });
      qc.invalidateQueries({ queryKey: ['postings'] });
    },
  });
}

// CSV 일괄 등록
export function useBulkAddBloggers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: BloggerInput[]) => {
      if (rows.length === 0) return [] as Blogger[];
      const normalized = rows.map((r) => ({
        ...r,
        blog_id: r.blog_id ?? extractBlogId(r.blog_url),
      }));
      const { data, error } = await supabase.from('bloggers').insert(normalized).select();
      if (error) throw error;
      return (data as Blogger[]) || [];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bloggers'] }),
  });
}

// 단가 표시 포맷 (1234567 → "1,234,567원"). null/undefined/0이면 "-"
export function formatUnitPrice(v: number | null | undefined): string {
  if (v === null || v === undefined) return '-';
  return `${v.toLocaleString('ko-KR')}원`;
}
