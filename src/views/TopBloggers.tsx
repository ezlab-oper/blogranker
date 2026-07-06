'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, ExternalLink, Mail, Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTopExternalBloggers,
  useTopExternalBloggersTotal,
  useTopBloggersComputedAt,
  useAvailableProgramsInTopBloggers,
  ALL_PROGRAMS,
  type Period,
  type TopExternalBlogger,
} from '@/hooks/useTopExternalBloggers';
import { useKeywords } from '@/hooks/useKeywords';
import { useBloggers } from '@/hooks/useBloggers';

// SessionStorage key — 메일 작성 화면으로 선택 블로거를 전달.
export const COMPOSE_SELECTION_KEY = 'top-bloggers-compose-selection';

export interface ComposeSelectionItem {
  blog_id: string;
  name: string;
  blog_url: string;
  platform: string | null;
  hit_keywords: string[];
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 7, label: '최근 7일' },
  { value: 14, label: '최근 14일' },
  { value: 30, label: '최근 30일' },
];

const ENGINE_OPTIONS = [
  { value: '__all__', label: '전체 엔진' },
  { value: '네이버', label: '네이버' },
  { value: '구글', label: '구글' },
];

const MIN_KW_OPTIONS = [1, 2, 3, 5, 10];

function buildBlogHomeUrl(b: TopExternalBlogger): string {
  if (b.sample_post_url?.includes('blog.naver.com')) return `https://blog.naver.com/${b.blog_id}`;
  if (b.sample_post_url?.includes('tistory.com')) return `https://${b.blog_id}.tistory.com`;
  if (b.sample_post_url?.includes('velog.io')) return `https://velog.io/@${b.blog_id}`;
  if (b.sample_post_url?.includes('brunch.co.kr')) return `https://brunch.co.kr/@${b.blog_id}`;
  return b.sample_post_url ?? '#';
}

export default function TopBloggers() {
  const { canPerformActions } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [period, setPeriod] = useState<Period>(30);
  const [program, setProgram] = useState<string>(ALL_PROGRAMS);
  const [engine, setEngine] = useState<string>('__all__');
  const [keyword, setKeyword] = useState<string>('__all__');
  const [minCount, setMinCount] = useState<number>(2);

  const [detail, setDetail] = useState<TopExternalBlogger | null>(null);
  // 선택된 블로거 — blog_id 기준 (필터 변경되어도 유지)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading } = useTopExternalBloggers({
    period,
    program: program === ALL_PROGRAMS ? undefined : program,
    engine: engine === '__all__' ? undefined : engine,
    keyword: keyword === '__all__' ? undefined : keyword,
    minKeywordCount: minCount,
  });
  const { data: poolTotal = 0 } = useTopExternalBloggersTotal(period, program);
  const { data: computedAt } = useTopBloggersComputedAt();
  const { data: availablePrograms = [] } = useAvailableProgramsInTopBloggers(period);

  // 키워드 옵션 — 프로그램이 선택되면 그 프로그램 키워드로 좁힘
  const { data: allKeywords = [] } = useKeywords();

  // 계약만료 블로거 — 외부 풀에는 노출되지만 시각적으로 별도 표시(빨강).
  const { data: allBloggers = [] } = useBloggers();
  const expiredBlogIds = useMemo(() => {
    const s = new Set<string>();
    allBloggers.forEach((b) => {
      if (b.blog_id && b.status === '계약만료') s.add(b.blog_id);
    });
    return s;
  }, [allBloggers]);
  const keywordOptions = useMemo(() => {
    let list = allKeywords;
    if (program !== ALL_PROGRAMS) {
      list = list.filter((k) => (k.program || '미지정') === program);
    }
    return list.map((k) => k.keyword).sort();
  }, [allKeywords, program]);

  // 선택 헬퍼
  const visibleIds = useMemo(() => rows.map((r) => r.blog_id), [rows]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someChecked = visibleIds.some((id) => selected.has(id)) && !allChecked;
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toComposeItem = (r: TopExternalBlogger): ComposeSelectionItem => ({
    blog_id: r.blog_id,
    name: r.author_name || r.blog_id,
    blog_url: buildBlogHomeUrl(r),
    platform: r.platform,
    hit_keywords: r.hit_keywords,
  });

  // "협업 요청 진행" — 선택된 블로거를 sessionStorage에 담아 메일 작성 화면으로 이동.
  // override가 있으면 그것만 사용 (디테일 모달에서 1명만 진행하는 경우).
  const handleStartCompose = (override?: TopExternalBlogger[]) => {
    // 방어: onClick={handleStartCompose}처럼 직접 넘기면 MouseEvent가 first arg로 들어와
    //   override.map() 에러 발생. Array.isArray로 가드.
    const list = Array.isArray(override) ? override : null;
    const items: ComposeSelectionItem[] = list
      ? list.map(toComposeItem)
      : rows.filter((r) => selected.has(r.blog_id)).map(toComposeItem);

    if (items.length === 0) {
      toast({ title: '선택된 블로거가 없습니다.', variant: 'destructive' });
      return;
    }
    try {
      sessionStorage.setItem(COMPOSE_SELECTION_KEY, JSON.stringify(items));
    } catch {
      // sessionStorage 실패 시에도 페이지로 이동은 진행
    }
    router.push('/results/top-bloggers/compose');
  };

  const handleResetFilters = () => {
    setProgram(ALL_PROGRAMS);
    setEngine('__all__');
    setKeyword('__all__');
    setMinCount(2);
  };

  const handleExportCsv = () => {
    if (rows.length === 0) {
      toast({ title: '내보낼 데이터 없음', variant: 'destructive' });
      return;
    }
    const headers = ['블로거명', 'blog_id', '플랫폼', '등장 키워드 수', '등장 횟수', '최저 순위', '평균 순위', '엔진', '최근 등장', '등장 키워드'];
    const lines = [
      headers.join(','),
      ...rows.map((r) => [
        `"${(r.author_name || r.blog_id).replace(/"/g, '""')}"`,
        r.blog_id,
        r.platform ?? '',
        r.hit_keyword_count,
        r.total_appearances,
        r.best_rank,
        r.avg_rank,
        `"${r.engines.join('|')}"`,
        new Date(r.last_seen_at).toLocaleDateString('ko-KR'),
        `"${r.hit_keywords.join(';').replace(/"/g, '""')}"`,
      ].join(',')),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `top-external-bloggers_${period}d_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Star className="w-6 h-6 text-amber-500" />
            상위노출 블로거
          </h1>
          <p className="text-muted-foreground mt-1">
            키워드 수집에서 잡힌 외부 블로거(협업 미계약) 풀. 매일 09:30 KST 자동 갱신.
          </p>
        </motion.div>

        {/* Filters */}
        <div className="p-4 bg-card rounded-xl border shadow-card space-y-3">
          <div className="flex flex-wrap gap-3">
            <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as Period)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {PERIOD_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={engine} onValueChange={setEngine}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {ENGINE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={program} onValueChange={(v) => { setProgram(v); setKeyword('__all__'); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="프로그램" /></SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value={ALL_PROGRAMS}>전체 프로그램</SelectItem>
                {availablePrograms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={keyword} onValueChange={setKeyword}>
              <SelectTrigger className="w-56"><SelectValue placeholder="키워드" /></SelectTrigger>
              <SelectContent className="bg-popover max-h-72">
                <SelectItem value="__all__">전체 키워드</SelectItem>
                {keywordOptions.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={String(minCount)} onValueChange={(v) => setMinCount(Number(v))}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {MIN_KW_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>최소 등장 {n}개 키워드</SelectItem>)}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleResetFilters}>초기화</Button>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              마지막 갱신: {computedAt ? new Date(computedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—'} KST
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30" />
              계약만료 블로거
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            총 <span className="font-semibold text-foreground">{rows.length}</span>명
            {(program !== ALL_PROGRAMS || engine !== '__all__' || keyword !== '__all__' || minCount !== 2) && (
              <span className="ml-2 text-xs">(필터 적용됨, 풀 {poolTotal}명 중)</span>
            )}
            {selected.size > 0 && (
              <span className="ml-3 text-foreground font-medium">
                · 선택 {selected.size}명
                <Button variant="link" size="sm" className="h-auto p-0 ml-2" onClick={() => setSelected(new Set())}>
                  선택 해제
                </Button>
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportCsv} className="gap-2">
              <Download className="w-4 h-4" />
              CSV 내보내기
            </Button>
            {canPerformActions && (
              <Button
                onClick={() => handleStartCompose()}
                disabled={selected.size === 0}
                className="gap-2 gradient-primary text-white"
              >
                <Mail className="w-4 h-4" />
                협업 요청 진행 ({selected.size}명)
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-lg animate-shimmer" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border shadow-card">
            <Star className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">조건에 맞는 외부 블로거가 없습니다</p>
            <p className="text-sm">최소 등장 횟수를 낮추거나 기간을 늘려보세요.</p>
            <Button variant="outline" onClick={handleResetFilters} className="mt-4">필터 초기화</Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {canPerformActions && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                        onCheckedChange={toggleAll}
                        aria-label="전체 선택"
                      />
                    </TableHead>
                  )}
                  <TableHead>블로거</TableHead>
                  <TableHead>플랫폼</TableHead>
                  <TableHead className="w-2/5">등장 키워드</TableHead>
                  <TableHead className="text-right">횟수</TableHead>
                  <TableHead className="text-right">최저</TableHead>
                  <TableHead className="text-right">평균</TableHead>
                  <TableHead>엔진</TableHead>
                  <TableHead>최근 등장</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => {
                  const shownKw = b.hit_keywords.slice(0, 4);
                  const extra = b.hit_keywords.length - shownKw.length;
                  const isExpired = expiredBlogIds.has(b.blog_id);
                  const rowBg = isExpired
                    ? 'bg-red-500/10 hover:bg-red-500/15'
                    : 'hover:bg-muted/30';
                  return (
                    <TableRow key={`${b.period_days}-${b.program}-${b.blog_id}`} className={`group ${rowBg}`}>
                      {canPerformActions && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(b.blog_id)}
                            onCheckedChange={() => toggleOne(b.blog_id)}
                            aria-label="선택"
                          />
                        </TableCell>
                      )}
                      <TableCell className="cursor-pointer" onClick={() => setDetail(b)}>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {b.author_name || b.blog_id}
                          {isExpired && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-700 dark:text-red-300">
                              계약만료
                            </span>
                          )}
                        </div>
                        <a href={buildBlogHomeUrl(b)} target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-0.5">
                          {b.blog_id} <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.platform || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {shownKw.map((k) => (
                            <Badge key={k} variant="secondary" className="text-[11px] font-normal">{k}</Badge>
                          ))}
                          {extra > 0 && (
                            <Badge variant="outline" className="text-[11px] font-normal">+{extra}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{b.total_appearances}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold">{b.best_rank}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{Number(b.avg_rank).toFixed(1)}</TableCell>
                      <TableCell className="text-xs">{b.engines.join(', ')}</TableCell>
                      <TableCell className="text-xs text-muted-foreground cursor-pointer" onClick={() => setDetail(b)}>
                        {new Date(b.last_seen_at).toLocaleDateString('ko-KR')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Detail modal */}
        <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
          <DialogContent className="max-w-2xl">
            {detail && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {detail.author_name || detail.blog_id}
                    <span className="text-sm text-muted-foreground font-normal">({detail.blog_id})</span>
                  </DialogTitle>
                  <DialogDescription>
                    <a href={buildBlogHomeUrl(detail)} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1">
                      블로그 열기 <ExternalLink className="w-3 h-3" />
                    </a>
                    {' · '}
                    {detail.platform || '플랫폼 미상'}
                    {' · '}
                    최근 등장 {new Date(detail.last_seen_at).toLocaleDateString('ko-KR')}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border p-3 bg-muted/30 text-center">
                    <div className="text-xs text-muted-foreground">등장 키워드</div>
                    <div className="text-2xl font-bold tabular-nums">{detail.hit_keyword_count}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30 text-center">
                    <div className="text-xs text-muted-foreground">총 등장</div>
                    <div className="text-2xl font-bold tabular-nums">{detail.total_appearances}</div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30 text-center">
                    <div className="text-xs text-muted-foreground">최저/평균 순위</div>
                    <div className="text-2xl font-bold tabular-nums">
                      {detail.best_rank}
                      <span className="text-sm text-muted-foreground"> / {Number(detail.avg_rank).toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">등장 키워드 ({detail.hit_keywords.length})</div>
                  <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 border rounded-md bg-muted/20">
                    {detail.hit_keywords.map((k) => (
                      <Badge key={k} variant="secondary" className="text-xs font-normal">{k}</Badge>
                    ))}
                  </div>
                </div>

                {detail.sample_post_url && (
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium">샘플 포스팅</div>
                    <a href={detail.sample_post_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 truncate">
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{detail.sample_post_url}</span>
                    </a>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetail(null)}>닫기</Button>
                  {canPerformActions && (
                    <Button
                      onClick={() => {
                        if (!detail) return;
                        // 이미 선택된 다른 행들 + 현재 모달 블로거를 합쳐 진행
                        const others = rows.filter((r) => selected.has(r.blog_id) && r.blog_id !== detail.blog_id);
                        const merged = [detail, ...others];
                        setDetail(null);
                        handleStartCompose(merged);
                      }}
                      className="gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      협업 요청 진행
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
