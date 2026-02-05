import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useKeywordCategories, useCreateKeyword, useUpdateKeyword } from '@/hooks/useKeywords';
import type { Keyword, KeywordCategory } from '@/types/database';

const formSchema = z.object({
  keyword: z.string().min(1, '키워드를 입력하세요'),
  category_id: z.string().nullable(),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface KeywordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: (Keyword & { category: KeywordCategory | null }) | null;
}

export function KeywordDialog({ open, onOpenChange, editData }: KeywordDialogProps) {
  const { data: categories } = useKeywordCategories();
  const createKeyword = useCreateKeyword();
  const updateKeyword = useUpdateKeyword();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      keyword: '',
      category_id: null,
      is_active: true,
    },
  });

  useEffect(() => {
    if (editData) {
      form.reset({
        keyword: editData.keyword,
        category_id: editData.category_id,
        is_active: editData.is_active,
      });
    } else {
      form.reset({
        keyword: '',
        category_id: null,
        is_active: true,
      });
    }
  }, [editData, form]);

  const onSubmit = (data: FormData) => {
    if (editData) {
      updateKeyword.mutate(
        { 
          id: editData.id, 
          keyword: data.keyword,
          category_id: data.category_id,
          is_active: data.is_active
        },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createKeyword.mutate(
        {
          keyword: data.keyword,
          category_id: data.category_id,
          is_active: data.is_active
        }, 
        {
          onSuccess: () => {
            form.reset();
            onOpenChange(false);
          },
        }
      );
    }
  };

  const isLoading = createKeyword.isPending || updateKeyword.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? '키워드 수정' : '키워드 추가'}</DialogTitle>
        </DialogHeader>
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
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
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
                    <p className="text-sm text-muted-foreground">
                      비활성화된 키워드는 수집에서 제외됩니다
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-success"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '저장 중...' : editData ? '수정' : '추가'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}