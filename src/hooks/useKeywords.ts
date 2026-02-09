import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Keyword, KeywordCategory } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export function useKeywords() {
  return useQuery({
    queryKey: ['keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keywords')
        .select('*, category:keyword_categories(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as (Keyword & { category: KeywordCategory | null })[];
    },
  });
}

export function useKeywordCategories() {
  return useQuery({
    queryKey: ['keyword_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as KeywordCategory[];
    },
  });
}

export function useCreateKeyword() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { keyword: string; program?: string | null; category_id: string | null; is_active: boolean }) => {
      const { data: result, error } = await supabase
        .from('keywords')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      toast({ title: '키워드가 추가되었습니다.' });
    },
    onError: (error: Error) => {
      toast({ 
        title: '키워드 추가 실패', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
}

export function useUpdateKeyword() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; keyword?: string; program?: string | null; category_id?: string | null; is_active?: boolean }) => {
      const { data: result, error } = await supabase
        .from('keywords')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      toast({ title: '키워드가 수정되었습니다.' });
    },
    onError: (error: Error) => {
      toast({ 
        title: '키워드 수정 실패', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
}

export function useDeleteKeyword() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('keywords')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      toast({ title: '키워드가 삭제되었습니다.' });
    },
    onError: (error: Error) => {
      toast({ 
        title: '키워드 삭제 실패', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
}