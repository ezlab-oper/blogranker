'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { MemoDialog } from './MemoDialog';
import {
  BLOG_GRADE_OPTIONS, BLOGGER_STATUS_OPTIONS,
  type Blogger, type BloggerInput, type BloggerStatus, type BlogGrade,
} from '@/hooks/useBloggers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Blogger | null; // 있으면 수정 모드
  // 추가 모드에서 폼에 미리 채워둘 값 (initial이 있으면 무시됨).
  // 외부 블로거를 협업으로 등록할 때 name·blog_url·blog_id·status 등을 자동 채우는 용도.
  prefill?: Partial<BloggerInput> | null;
  onSubmit: (input: BloggerInput) => Promise<void> | void;
  isPending?: boolean;
}

const empty: BloggerInput = {
  name: '',
  blog_url: '',
  email: '',
  unit_price: null,
  status: null,
  contract_end_date: null,
  blog_grade: null,
  is_influencer: false,
  memo: '',
};

const CONTINUOUS_DATE = '2999-12-31'; // '계속' 센티넬

export function BloggerDialog({ open, onOpenChange, initial, prefill, onSubmit, isPending }: Props) {
  const [form, setForm] = useState<BloggerInput>(empty);
  const [memoOpen, setMemoOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              name: initial.name,
              blog_url: initial.blog_url,
              email: initial.email || '',
              unit_price: initial.unit_price,
              status: initial.status,
              contract_end_date: initial.contract_end_date,
              blog_grade: initial.blog_grade,
              is_influencer: initial.is_influencer,
              memo: initial.memo || '',
            }
          : { ...empty, ...(prefill ?? {}) }
      );
    }
  }, [open, initial, prefill]);

  // 단가 표시용 포맷팅 — 입력 시 숫자만 받아 천 단위 콤마 + "원"
  const priceDisplay =
    form.unit_price !== null && form.unit_price !== undefined
      ? `${form.unit_price.toLocaleString('ko-KR')}원`
      : '';

  const setPriceFromInput = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    setForm((p) => ({ ...p, unit_price: digits === '' ? null : parseInt(digits, 10) }));
  };

  // 계약 만료일 표시: '계속' 센티넬이면 Calendar에 selected=undefined, 라벨은 '계속'
  const isContinuous = form.contract_end_date === CONTINUOUS_DATE;
  const contractDate =
    form.contract_end_date && !isContinuous ? new Date(form.contract_end_date) : undefined;
  const contractDateLabel = isContinuous
    ? '계속'
    : contractDate
    ? format(contractDate, 'yyyy-MM-dd', { locale: ko })
    : '';

  const canSubmit = form.name.trim() !== '' && form.blog_url.trim() !== '';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      ...form,
      email: form.email?.trim() || null,
      memo: form.memo?.trim() || null,
      // 미선택 시 '계속'(2999-12-31)으로 자동 설정
      contract_end_date: form.contract_end_date || CONTINUOUS_DATE,
      // 미선택 시 '일반'으로 자동 설정
      blog_grade: form.blog_grade || '일반',
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{initial ? '블로거 수정' : '블로거 추가'}</DialogTitle>
            <DialogDescription>협업 블로거 정보를 입력하세요. (이름·블로그 URL 필수)</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="b-name">블로거명 *</Label>
                <Input id="b-name" value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="예: 김지수" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-email">이메일</Label>
                <Input id="b-email" type="email" value={form.email || ''}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="example@email.com" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="b-url">블로그 URL *</Label>
              <Input id="b-url" value={form.blog_url}
                onChange={(e) => setForm((p) => ({ ...p, blog_url: e.target.value }))}
                placeholder="https://blog.naver.com/사용자아이디" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="b-price">단가</Label>
                <Input id="b-price" value={priceDisplay}
                  onChange={(e) => setPriceFromInput(e.target.value)}
                  placeholder="0원" inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>상태</Label>
                <Select
                  value={form.status ?? ''}
                  onValueChange={(v) => setForm((p) => ({ ...p, status: (v as BloggerStatus) || null }))}>
                  <SelectTrigger><SelectValue placeholder="상태 선택" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {BLOGGER_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>계약 만료일(미선택 시 계속)</Label>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline"
                      className={cn('w-full justify-start font-normal', !contractDateLabel && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {contractDateLabel || '날짜 선택'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start" side="top" sideOffset={4}>
                    <div className="flex items-center gap-2 p-2 border-b">
                      <Button size="sm" variant="ghost" className="flex-1"
                        onClick={() => {
                          setForm((p) => ({ ...p, contract_end_date: format(new Date(), 'yyyy-MM-dd') }));
                          setCalOpen(false);
                        }}>
                        오늘 날짜
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1 text-muted-foreground"
                        onClick={() => {
                          setForm((p) => ({ ...p, contract_end_date: null }));
                          setCalOpen(false);
                        }}>
                        계속(미선택)
                      </Button>
                    </div>
                    <Calendar mode="single" selected={contractDate}
                      onSelect={(d) => {
                        setForm((p) => ({ ...p, contract_end_date: d ? format(d, 'yyyy-MM-dd') : null }));
                        setCalOpen(false);
                      }}
                      initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>블로그 지수</Label>
                <Select
                  value={form.blog_grade ?? ''}
                  onValueChange={(v) => setForm((p) => ({ ...p, blog_grade: (v as BlogGrade) || null }))}>
                  <SelectTrigger><SelectValue placeholder="지수 선택" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-72">
                    {BLOG_GRADE_OPTIONS.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">인플루언서</Label>
                  <p className="text-xs text-muted-foreground">{form.is_influencer ? '유' : '무'}</p>
                </div>
                <Switch checked={form.is_influencer}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, is_influencer: v }))} />
              </div>
              <div className="space-y-2">
                <Label>메모</Label>
                <Button variant="outline" className="w-full justify-start gap-2"
                  onClick={() => setMemoOpen(true)}>
                  <FileText className="w-4 h-4" />
                  {form.memo ? `메모 (${form.memo.length}자)` : '메모 입력...'}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {initial ? '저장' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemoDialog
        open={memoOpen}
        initialMemo={form.memo}
        title={`${form.name || '블로거'} 메모`}
        onSave={(m) => setForm((p) => ({ ...p, memo: m }))}
        onOpenChange={setMemoOpen}
      />
    </>
  );
}
