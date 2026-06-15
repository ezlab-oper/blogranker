'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PenSquare, Edit, Trash2, ChevronLeft, ChevronRight, ExternalLink, FileText, TrendingUp } from 'lucide-react';
import { usePostings, useAddPosting, useUpdatePosting, useDeletePosting, type Posting } from '@/hooks/usePostings';
import { useBloggers } from '@/hooks/useBloggers';
import { PostingDialog } from '@/components/blog-posting/PostingDialog';
import { PostingRankModal } from '@/components/blog-posting/PostingRankModal';
import { PostingCsvUpload } from '@/components/blog-posting/PostingCsvUpload';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

export default function PostingsList() {
  const { canPerformActions } = useAuth();
  const { toast } = useToast();
  const { data: postings = [], isLoading } = usePostings();
  const { data: bloggers = [] } = useBloggers();
  const addPosting = useAddPosting();
  const updatePosting = useUpdatePosting();
  const deletePosting = useDeletePosting();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Posting | null>(null);
  const [rankTarget, setRankTarget] = useState<Posting | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dateRange, setDateRange] = useState<string>('all');

  // 기간 필터: published_at 기준. 'all'은 null 포함 전체, N일은 published_at >= cutoff.
  const filtered = useMemo(() => {
    const cutoff = cutoffFromRange(dateRange);
    if (!cutoff) return postings;
    return postings.filter((p) => p.published_at && p.published_at >= cutoff);
  }, [postings, dateRange]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = useMemo(() => filtered.slice(start, start + pageSize), [filtered, start, pageSize]);

  const handleSubmit = async (input: Parameters<typeof addPosting.mutateAsync>[0]) => {
    try {
      if (editing) {
        await updatePosting.mutateAsync({ id: editing.id, patch: input });
        toast({ title: '포스팅 수정 완료' });
      } else {
        await addPosting.mutateAsync(input);
        toast({ title: '포스팅 추가 완료' });
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류';
      const isDup = msg.includes('duplicate') || msg.includes('unique');
      toast({
        title: '저장 실패',
        description: isDup ? '이미 등록된 포스팅 URL입니다.' : msg,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (p: Posting) => {
    try {
      await deletePosting.mutateAsync(p.id);
      toast({ title: '포스팅 삭제됨' });
    } catch (e) {
      toast({ title: '삭제 실패', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">포스팅 목록</h1>
            <p className="text-muted-foreground mt-1">협업 블로거의 포스팅 URL을 등록하고 관리합니다.</p>
          </div>
          {canPerformActions && (
            <div className="flex items-center gap-2">
              <PostingCsvUpload />
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
                <PenSquare className="w-4 h-4" /> 포스팅 추가
              </Button>
            </div>
          )}
        </motion.div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 p-4 bg-card rounded-xl border shadow-card">
          <Select
            value={dateRange}
            onValueChange={(v) => { setDateRange(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="기간" /></SelectTrigger>
            <SelectContent className="bg-popover">
              {DATE_RANGE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {dateRange !== 'all' && (
            <Button variant="outline" onClick={() => { setDateRange('all'); setPage(1); }}>
              초기화
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 <span className="font-semibold text-foreground">{total}</span>건
            {dateRange !== 'all' && (
              <span className="ml-2 text-xs">(기간 필터, 전체 {postings.length}건 중)</span>
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

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg animate-shimmer" />)}
          </div>
        ) : items.length > 0 ? (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-48">블로거명</TableHead>
                  <TableHead>포스팅 URL</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="w-28 text-center">순위 추이</TableHead>
                  <TableHead className="w-36">업로드 날짜</TableHead>
                  {canPerformActions && <TableHead className="text-right w-28">작업</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell className="font-medium">
                      {p.blogger?.name || <span className="text-muted-foreground text-sm">(미지정)</span>}
                    </TableCell>
                    <TableCell>
                      <a href={p.posting_url} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                        <span className="truncate max-w-md">{p.posting_url}</span>
                        <ExternalLink className="w-3 h-3 opacity-50 flex-shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{p.title || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                        onClick={() => setRankTarget(p)}>
                        <TrendingUp className="w-3.5 h-3.5" />
                        확인
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.published_at
                        ? new Date(p.published_at).toLocaleDateString('ko-KR')
                        : <span className="opacity-60">-</span>}
                    </TableCell>
                    {canPerformActions && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => { setEditing(p); setDialogOpen(true); }}>
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
                                <AlertDialogTitle>포스팅 삭제</AlertDialogTitle>
                                <AlertDialogDescription className="break-all">{p.posting_url}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(p)}
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
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border shadow-card">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">등록된 포스팅이 없습니다</p>
            <p className="text-sm">"포스팅 추가"로 등록하세요.</p>
          </div>
        )}

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

        <PostingDialog
          open={dialogOpen}
          onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
          initial={editing}
          bloggers={bloggers}
          onSubmit={handleSubmit}
          isPending={addPosting.isPending || updatePosting.isPending}
        />

        <PostingRankModal
          open={!!rankTarget}
          onOpenChange={(o) => { if (!o) setRankTarget(null); }}
          url={rankTarget?.posting_url || null}
          title={rankTarget?.title || rankTarget?.blogger?.name || undefined}
        />
      </div>
    </AppLayout>
  );
}
