'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UserPlus, Edit, Trash2, ChevronLeft, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import {
  useBloggers, useAddBlogger, useUpdateBlogger, useDeleteBlogger,
  formatUnitPrice,
  BLOGGER_STATUS_OPTIONS,
  type Blogger, type BloggerStatus,
} from '@/hooks/useBloggers';
import { BloggerDialog } from '@/components/blog-posting/BloggerDialog';
import { BloggerCsvUpload } from '@/components/blog-posting/BloggerCsvUpload';
import { MemoDialog } from '@/components/blog-posting/MemoDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const DATE_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체 기간' },
  { value: '7', label: '최근 7일' },
  { value: '30', label: '최근 30일' },
  { value: '90', label: '최근 90일' },
  { value: '365', label: '최근 1년' },
];

// KST 기준 N일 전 자정 ISO. 'all'이면 null.
function cutoffFromRange(range: string): string | null {
  if (range === 'all') return null;
  const days = parseInt(range);
  if (!Number.isFinite(days)) return null;
  const nowKstMs = Date.now() + 9 * 60 * 60 * 1000;
  const todayKstStart = Math.floor(nowKstMs / 86400000) * 86400000;
  const cutoffKst = todayKstStart - (days - 1) * 86400000;
  return new Date(cutoffKst - 9 * 60 * 60 * 1000).toISOString();
}

// 오늘 날짜(YYYY-MM-DD)
const todayStr = () => new Date().toISOString().slice(0, 10);

// 계약만료일이 지난 블로거는 상태를 '계약만료'로 본다 (저장값과 무관하게 화면용)
function effectiveStatus(b: Blogger): BloggerStatus | null {
  if (b.contract_end_date && b.contract_end_date < todayStr()) return '계약만료';
  return b.status;
}

export default function BloggersList() {
  const { canPerformActions } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: bloggers = [], isLoading } = useBloggers();
  const addBlogger = useAddBlogger();
  const updateBlogger = useUpdateBlogger();
  const deleteBlogger = useDeleteBlogger();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Blogger | null>(null);
  const [memoTarget, setMemoTarget] = useState<Blogger | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<BloggerStatus | ''>('');
  const [infFilter, setInfFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  // 계약만료일이 지났는데 status가 '계약만료'가 아닌 행 → DB에 일괄 반영 (editor 권한 보유 시)
  useEffect(() => {
    if (!canPerformActions || bloggers.length === 0) return;
    const today = todayStr();
    const expired = bloggers.filter(
      (b) => b.contract_end_date && b.contract_end_date < today && b.status !== '계약만료'
    );
    if (expired.length === 0) return;
    (async () => {
      const { error } = await supabase
        .from('bloggers')
        .update({ status: '계약만료' })
        .in('id', expired.map((b) => b.id));
      if (!error) queryClient.invalidateQueries({ queryKey: ['bloggers'] });
    })();
  }, [bloggers, canPerformActions, queryClient]);

  // 필터 적용 (상태·인플·등록일 기간)
  const filtered = useMemo(() => {
    const cutoff = cutoffFromRange(dateRange);
    return bloggers.filter((b) => {
      if (statusFilter && effectiveStatus(b) !== statusFilter) return false;
      if (infFilter === 'yes' && !b.is_influencer) return false;
      if (infFilter === 'no' && b.is_influencer) return false;
      if (cutoff && b.created_at < cutoff) return false;
      return true;
    });
  }, [bloggers, statusFilter, infFilter, dateRange]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = useMemo(() => filtered.slice(start, start + pageSize), [filtered, start, pageSize]);

  const handleAddOrUpdate = async (input: Parameters<typeof addBlogger.mutateAsync>[0]) => {
    try {
      if (editing) {
        await updateBlogger.mutateAsync({ id: editing.id, patch: input });
        toast({ title: '블로거 수정 완료' });
      } else {
        await addBlogger.mutateAsync(input);
        toast({ title: '블로거 추가 완료' });
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류';
      toast({ title: '저장 실패', description: msg, variant: 'destructive' });
    }
  };

  const handleDelete = async (b: Blogger) => {
    try {
      await deleteBlogger.mutateAsync(b.id);
      toast({ title: '블로거 삭제됨' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류';
      toast({ title: '삭제 실패', description: msg, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">블로거 목록</h1>
            <p className="text-muted-foreground mt-1">협업 블로거를 등록하고 관리합니다.</p>
          </div>
          {canPerformActions && (
            <div className="flex items-center gap-2">
              <BloggerCsvUpload />
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
                <UserPlus className="w-4 h-4" /> 블로거 추가
              </Button>
            </div>
          )}
        </motion.div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 p-4 bg-card rounded-xl border shadow-card">
          <Select
            value={statusFilter || 'all'}
            onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : (v as BloggerStatus)); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="상태" /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">전체 상태</SelectItem>
              {BLOGGER_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={infFilter}
            onValueChange={(v) => { setInfFilter(v as 'all' | 'yes' | 'no'); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="인플" /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">전체 인플</SelectItem>
              <SelectItem value="yes">유</SelectItem>
              <SelectItem value="no">무</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dateRange}
            onValueChange={(v) => { setDateRange(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="등록일 기간" /></SelectTrigger>
            <SelectContent className="bg-popover">
              {DATE_RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline"
            onClick={() => { setStatusFilter(''); setInfFilter('all'); setDateRange('all'); setPage(1); }}>
            초기화
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 <span className="font-semibold text-foreground">{total}</span>명
            {(statusFilter || infFilter !== 'all' || dateRange !== 'all') && (
              <span className="ml-2 text-xs">(필터 적용됨, 전체 {bloggers.length}명 중)</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">페이지당</span>
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {PAGE_SIZE_OPTIONS.map((s) => <SelectItem key={s} value={s.toString()}>{s}개</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg animate-shimmer" />)}
          </div>
        ) : items.length > 0 ? (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-28">등록일</TableHead>
                  <TableHead>블로거명</TableHead>
                  <TableHead>블로그</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead className="text-right">단가</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>계약만료일</TableHead>
                  <TableHead>블로그 지수</TableHead>
                  <TableHead className="text-center">인플</TableHead>
                  <TableHead className="text-center">메모</TableHead>
                  {canPerformActions && <TableHead className="text-right">작업</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => {
                  const eff = effectiveStatus(b);
                  return (
                  <TableRow key={b.id} className="group">
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      <a href={b.blog_url} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                        {b.blog_id || b.blog_url.replace(/^https?:\/\//, '').slice(0, 30)}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">{b.email || '-'}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatUnitPrice(b.unit_price)}</TableCell>
                    <TableCell>
                      {eff ? (
                        <Badge variant="outline"
                          className={cn(eff === '계약만료' && 'text-destructive border-destructive/40')}>
                          {eff}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.contract_end_date === '2999-12-31'
                        ? <span className="text-muted-foreground">계속</span>
                        : (b.contract_end_date || '-')}
                    </TableCell>
                    <TableCell>{b.blog_grade ? <Badge variant="secondary">{b.blog_grade}</Badge> : '-'}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn('text-xs font-medium', b.is_influencer ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {b.is_influencer ? '유' : '무'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setMemoTarget(b)}
                        title={b.memo || '메모 없음'}>
                        <FileText className={cn('w-4 h-4', b.memo ? 'text-foreground' : 'text-muted-foreground/40')} />
                      </Button>
                    </TableCell>
                    {canPerformActions && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => { setEditing(b); setDialogOpen(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{b.name} 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  이 블로거를 삭제하면 연결된 포스팅의 블로거 정보가 해제됩니다 (포스팅 자체는 유지).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(b)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border shadow-card">
            <UserPlus className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">등록된 블로거가 없습니다</p>
            <p className="text-sm">"블로거 추가" 또는 "CSV 업로드"로 등록하세요.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Dialogs */}
        <BloggerDialog
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
          initial={editing}
          onSubmit={handleAddOrUpdate}
          isPending={addBlogger.isPending || updateBlogger.isPending}
        />
        <MemoDialog
          open={!!memoTarget}
          initialMemo={memoTarget?.memo}
          title={`${memoTarget?.name || ''} 메모`}
          onSave={async (m) => {
            if (!memoTarget) return;
            try {
              await updateBlogger.mutateAsync({ id: memoTarget.id, patch: { memo: m } });
              toast({ title: '메모 저장됨' });
            } catch (e) {
              toast({ title: '메모 저장 실패', variant: 'destructive' });
            }
          }}
          onOpenChange={(o) => { if (!o) setMemoTarget(null); }}
        />
      </div>
    </AppLayout>
  );
}
