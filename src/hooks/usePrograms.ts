import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Program {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function usePrograms() {
  return useQuery({
    queryKey: ['programs'],
    queryFn: async (): Promise<Program[]> => {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data as Program[]) || [];
    },
  });
}

export function useAddProgram() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { name: string; sort_order?: number }) => {
      const { data, error } = await supabase.from('programs').insert(input).select().single();
      if (error) throw error;
      return data as Program;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] });
      toast({ title: '프로그램 추가됨' });
    },
    onError: (e: Error) => {
      const msg = e.message.includes('duplicate') || e.message.includes('unique')
        ? '같은 이름의 프로그램이 이미 있습니다.'
        : e.message;
      toast({ title: '추가 실패', description: msg, variant: 'destructive' });
    },
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; sort_order?: number }) => {
      const { data, error } = await supabase.from('programs').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as Program;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] });
      toast({ title: '프로그램 수정됨' });
    },
    onError: (e: Error) => toast({ title: '수정 실패', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteProgram() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('programs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['programs'] });
      toast({ title: '프로그램 삭제됨' });
    },
    onError: (e: Error) => toast({ title: '삭제 실패', description: e.message, variant: 'destructive' }),
  });
}
