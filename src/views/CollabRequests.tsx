'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, ExternalLink, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useBloggers, type Blogger } from '@/hooks/useBloggers';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function timeFromNow(iso: string | null): string {
  if (!iso) return '-';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export default function CollabRequests() {
  const { canPerformActions } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: bloggers = [], isLoading } = useBloggers();

  // 협업 요청 + 협업 거절 상태 모두, requested_at DESC.
  const requests = useMemo(() => {
    return bloggers
      .filter((b) => b.status === '협업 요청' || b.status === '협업 거절')
      .sort((a, b) => {
        const at = a.requested_at ? new Date(a.requested_at).getTime() : 0;
        const bt = b.requested_at ? new Date(b.requested_at).getTime() : 0;
        return bt - at;
      });
  }, [bloggers]);

  const pendingCount = useMemo(() => requests.filter((b) => b.status === '협업 요청').length, [requests]);
  const rejectedCount = requests.length - pendingCount;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const total = requests.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = useMemo(() => requests.slice(start, start + pageSize), [requests, start, pageSize]);

  const [processingId, setProcessingId] = useState<string | null>(null);

  // 계약됨 처리: status='계약됨' + created_at = now (등록일 갱신) → 블로거 목록으로 이동
  const handleAccept = async (b: Blogger) => {
    if (processingId) return;
    setProcessingId(b.id);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('bloggers')
        .update({ status: '계약됨', created_at: nowIso })
        .eq('id', b.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['bloggers'] });
      toast({ title: '계약됨으로 변경', description: `${b.name} (등록일 갱신됨)` });
      router.push('/blog-posting/bloggers');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류';
      toast({ title: '변경 실패', description: msg, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  // 거절 처리: status='협업 거절'. 협업 요청 페이지에 거절 표시로 남는다.
  const handleReject = async (b: Blogger) => {
    if (processingId) return;
    setProcessingId(b.id);
    try {
      const { error } = await supabase
        .from('bloggers')
        .update({ status: '협업 거절' })
        .eq('id', b.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['bloggers'] });
      toast({ title: '협업 거절로 변경', description: b.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류';
      toast({ title: '변경 실패', description: msg, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  // 목록에서 완전 삭제: bloggers 행 삭제.
  const handleDelete = async (b: Blogger) => {
    if (processingId) return;
    setProcessingId(b.id);
    try {
      const { error } = await supabase.from('bloggers').delete().eq('id', b.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['bloggers'] });
      toast({ title: '삭제됨', description: b.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류';
      toast({ title: '삭제 실패', description: msg, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            협업 요청
          </h1>
          <p className="text-muted-foreground mt-1">
            협업 제안 메일을 보낸 블로거 목록입니다. 요청일 최신순. 계약됨으로 변경하면 블로거 목록으로 자동 이동합니다.
          </p>
        </motion.div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-muted-foreground">
            총 <span className="font-semibold text-foreground">{total}</span>건
            <span className="ml-2 text-xs">
              (대기 <span className="text-amber-700 dark:text-amber-300 font-medium">{pendingCount}</span> ·
              거절 <span className="text-destructive font-medium">{rejectedCount}</span>)
            </span>
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
            {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-lg animate-shimmer" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border shadow-card">
            <Mail className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">대기 중인 협업 요청이 없습니다</p>
            <p className="text-sm">
              상위노출 블로거 페이지에서 협업 요청을 보내면 여기에 표시됩니다.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/results/top-bloggers')}>
              상위노출 블로거로 이동
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-44">블로거</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead className="w-40">요청일</TableHead>
                  <TableHead className="w-32">상태</TableHead>
                  <TableHead>메모 (최신 1줄)</TableHead>
                  {canPerformActions && <TableHead className="w-56 text-right">액션</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((b) => {
                  const memoFirstLine = b.memo?.split('\n')[0] ?? '';
                  const isProcessing = processingId === b.id;
                  const isRejected = b.status === '협업 거절';
                  return (
                    <TableRow key={b.id} className={`group ${isRejected ? 'opacity-70' : ''}`}>
                      <TableCell>
                        <div className="font-medium text-sm">{b.name}</div>
                        <a href={b.blog_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-0.5">
                          {b.blog_id || b.blog_url} <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                        {b.email || <span className="opacity-50">-</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{b.requested_at ? new Date(b.requested_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</div>
                        <div className="text-xs text-muted-foreground">{timeFromNow(b.requested_at)}</div>
                      </TableCell>
                      <TableCell>
                        {isRejected ? (
                          <Badge className="bg-destructive/15 text-destructive border border-destructive/30 font-normal">
                            협업 거절
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-normal">
                            협업 요청
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-md">
                        {memoFirstLine || <span className="opacity-50">-</span>}
                      </TableCell>
                      {canPerformActions && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" className="h-7 gap-1 text-xs gradient-primary text-white"
                                  disabled={isProcessing}>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  계약됨
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>계약 체결 처리</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>{b.name}</strong> 의 상태를 <strong>계약됨</strong>으로 변경합니다.
                                    등록일이 지금 시각으로 갱신되고, 블로거 목록으로 이동합니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleAccept(b)}
                                    className="gradient-primary text-white">
                                    계약됨으로 변경
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                                  disabled={isProcessing || isRejected}>
                                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                                  거절
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>협업 거절 처리</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>{b.name}</strong> 이(가) 협업 제안을 거절한 것으로 기록합니다.
                                    상태가 <strong>'협업 거절'</strong>로 바뀌고, 이 페이지에 거절 표시로 남아 발송 이력을 추적할 수 있습니다.
                                    (다시 요청하려면 상위노출 블로거 페이지에서 재선택하세요.)
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleReject(b)}>거절 처리</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                                  disabled={isProcessing}
                                  title="목록에서 삭제">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>협업 요청 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>{b.name}</strong> 을(를) 협업 요청 목록에서 <strong>완전히 삭제</strong>합니다.
                                    블로거 정보·발송 이력·메모가 모두 함께 제거되며, 복구할 수 없습니다.
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
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>처음</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>이전</Button>
            <span className="text-sm tabular-nums px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>다음</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>마지막</Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
