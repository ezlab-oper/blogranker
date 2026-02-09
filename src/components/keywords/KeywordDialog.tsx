import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PROGRAMS } from '@/components/keywords/KeywordFilterBar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useKeywordCategories, useCreateKeyword, useUpdateKeyword } from '@/hooks/useKeywords';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { Keyword, KeywordCategory } from '@/types/database';

const formSchema = z.object({
  keyword: z.string().min(1, '키워드를 입력하세요'),
  program: z.string().nullable(),
  category_id: z.string().nullable(),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface KeywordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: (Keyword & { category: KeywordCategory | null }) | null;
}

function CategoryManager() {
  const { data: categories } = useKeywordCategories();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('keyword_categories').insert({ name: newName.trim(), color: newColor });
    if (error) {
      toast({ title: '카테고리 추가 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '카테고리가 추가되었습니다.' });
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['keyword_categories'] });
    }
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from('keyword_categories').update({ name: editName, color: editColor }).eq('id', id);
    if (error) {
      toast({ title: '수정 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '카테고리가 수정되었습니다.' });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['keyword_categories'] });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('keyword_categories').delete().eq('id', id);
    if (error) {
      toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '카테고리가 삭제되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['keyword_categories'] });
    }
  };

  return (
    <div className="space-y-4">
      {/* Add new */}
      <div className="flex items-center gap-2">
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
        <Input placeholder="새 카테고리 이름" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1" />
        <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {categories?.map(cat => (
          <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg border">
            {editingId === cat.id ? (
              <>
                <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 h-8" />
                <Button size="sm" variant="outline" onClick={() => handleUpdate(cat.id)}>저장</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
              </>
            ) : (
              <>
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                <span className="flex-1 text-sm">{cat.name}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color || '#6366f1'); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        ))}
        {(!categories || categories.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">등록된 카테고리가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

export function KeywordDialog({ open, onOpenChange, editData }: KeywordDialogProps) {
  const { data: categories } = useKeywordCategories();
  const createKeyword = useCreateKeyword();
  const updateKeyword = useUpdateKeyword();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { keyword: '', program: null, category_id: null, is_active: true },
  });

  useEffect(() => {
    if (editData) {
      form.reset({ keyword: editData.keyword, program: editData.program ?? null, category_id: editData.category_id, is_active: editData.is_active });
    } else {
      form.reset({ keyword: '', program: null, category_id: null, is_active: true });
    }
  }, [editData, form]);

  const onSubmit = (data: FormData) => {
    if (editData) {
      updateKeyword.mutate(
        { id: editData.id, keyword: data.keyword, program: data.program, category_id: data.category_id, is_active: data.is_active },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createKeyword.mutate(
        { keyword: data.keyword, program: data.program, category_id: data.category_id, is_active: data.is_active },
        { onSuccess: () => { form.reset(); onOpenChange(false); } }
      );
    }
  };

  const isLoading = createKeyword.isPending || updateKeyword.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? '키워드 수정' : '키워드 관리'}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="keyword">
          <TabsList className="w-full">
            <TabsTrigger value="keyword" className="flex-1">{editData ? '키워드 수정' : '키워드 추가'}</TabsTrigger>
            <TabsTrigger value="category" className="flex-1">카테고리 관리</TabsTrigger>
          </TabsList>

          <TabsContent value="keyword" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="keyword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>키워드</FormLabel>
                      <FormControl>
                        <Input placeholder="검색할 키워드 입력" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="program"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>프로그램</FormLabel>
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="프로그램 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">프로그램 없음</SelectItem>
                          {PROGRAMS.map((prog) => (
                            <SelectItem key={prog} value={prog}>{prog}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리</FormLabel>
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="카테고리 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">카테고리 없음</SelectItem>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                {cat.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel className="text-base">활성화</FormLabel>
                        <p className="text-sm text-muted-foreground">비활성화된 키워드는 수집에서 제외됩니다</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-success" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                  <Button type="submit" disabled={isLoading}>{isLoading ? '저장 중...' : editData ? '수정' : '추가'}</Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="category" className="mt-4">
            <CategoryManager />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
