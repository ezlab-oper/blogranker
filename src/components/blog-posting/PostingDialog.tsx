'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { extractBlogId } from '@/hooks/useBlogUrls';
import { supabase } from '@/integrations/supabase/client';
import type { Blogger } from '@/hooks/useBloggers';
import type { Posting, PostingInput } from '@/hooks/usePostings';
import { useKeywords } from '@/hooks/useKeywords';
import { usePrograms } from '@/hooks/usePrograms';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Posting | null;
  bloggers: Blogger[];
  onSubmit: (input: PostingInput) => Promise<void> | void;
  isPending?: boolean;
}

// 쉼표·줄바꿈으로 분리 + 트림 + 중복 제거
function parseKeywords(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function PostingDialog({ open, onOpenChange, initial, bloggers, onSubmit, isPending }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [publishedDate, setPublishedDate] = useState(''); // YYYY-MM-DD (KST)
  const [manualBloggerId, setManualBloggerId] = useState<string>('');
  const [program, setProgram] = useState<string>('');
  const [keywordsText, setKeywordsText] = useState<string>('');
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const lastFetchedUrl = useRef<string>('');
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  // 사용자가 단가를 직접 손댔는지 — 손댔으면 블로거 매칭이 바뀌어도 덮어쓰지 않음.
  const userTouchedPrice = useRef(false);

  const { data: registeredKeywords = [] } = useKeywords();
  const { data: programs = [] } = usePrograms();

  useEffect(() => {
    if (open) {
      setUrl(initial?.posting_url || '');
      setTitle(initial?.title || '');
      const pub = initial?.published_at ? new Date(initial.published_at) : null;
      setPublishedDate(pub ? pub.toISOString().slice(0, 10) : '');
      setManualBloggerId(initial?.blogger_id || '');
      setProgram(initial?.program || '');
      setKeywordsText((initial?.target_keywords || []).join(', '));
      setUnitPrice(initial?.unit_price ?? null);
      userTouchedPrice.current = initial?.unit_price != null; // 수정 모드 = 이미 값 있으면 touched로 간주
      lastFetchedUrl.current = initial?.posting_url || '';
      setMetaError(null);
    }
  }, [open, initial]);

  // URL 확정(blur or 디바운스) 시 fetch-post-meta 호출 → 제목·발행일 자동 채움
  const fetchMeta = async (targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
    if (trimmed === lastFetchedUrl.current) return;
    lastFetchedUrl.current = trimmed;
    setFetchingMeta(true);
    setMetaError(null);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-post-meta', {
        body: { url: trimmed },
      });
      if (error) throw error;
      if (data?.success) {
        if (data.title) setTitle((prev) => prev || data.title);
        if (data.published_at) {
          const d = new Date(data.published_at);
          if (!isNaN(d.getTime())) {
            setPublishedDate((prev) => prev || d.toISOString().slice(0, 10));
          }
        }
      }
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : '메타 추출 실패');
    } finally {
      setFetchingMeta(false);
    }
  };

  // URL → 블로거 자동 매칭
  const autoMatch = useMemo<Blogger | null>(() => {
    const blogId = extractBlogId(url);
    if (!blogId) return null;
    return bloggers.find((b) => b.blog_id === blogId) || null;
  }, [url, bloggers]);

  const effectiveBloggerId = autoMatch?.id || manualBloggerId || null;
  const effectiveBlogger = autoMatch || bloggers.find((b) => b.id === manualBloggerId) || null;

  // 블로거 매칭이 바뀌면 단가 prefill (사용자가 직접 수정한 적 없을 때만)
  useEffect(() => {
    if (!userTouchedPrice.current && effectiveBlogger?.unit_price != null) {
      setUnitPrice(effectiveBlogger.unit_price);
    }
  }, [effectiveBlogger]);

  // 의뢰 키워드 파싱
  const parsedKeywords = useMemo(() => parseKeywords(keywordsText), [keywordsText]);

  // 추적 키워드를 program별로 인덱싱
  const registeredIdx = useMemo(() => {
    const byProgram = new Map<string, Set<string>>();
    const any = new Set<string>();
    for (const k of registeredKeywords) {
      any.add(k.keyword);
      const p = k.program || '__no_program__';
      if (!byProgram.has(p)) byProgram.set(p, new Set());
      byProgram.get(p)!.add(k.keyword);
    }
    return { byProgram, any };
  }, [registeredKeywords]);

  // 의뢰 키워드 각각의 매칭 상태
  // exact: 선택한 program의 추적 키워드와 일치 (가장 좋음)
  // other-program: 다른 프로그램의 추적 키워드와 일치 (program 미선택이거나 다른 program)
  // unmatched: 추적 키워드 목록에 없음
  const keywordMatchResults = useMemo(() => {
    return parsedKeywords.map((kw) => {
      const inAny = registeredIdx.any.has(kw);
      const inSelectedProgram = program
        ? registeredIdx.byProgram.get(program)?.has(kw) ?? false
        : inAny;
      const status =
        inSelectedProgram ? 'exact' : inAny ? 'other-program' : 'unmatched';
      return { keyword: kw, status } as const;
    });
  }, [parsedKeywords, program, registeredIdx]);

  const matchSummary = useMemo(() => {
    const exact = keywordMatchResults.filter((r) => r.status === 'exact').length;
    const other = keywordMatchResults.filter((r) => r.status === 'other-program').length;
    const unmatched = keywordMatchResults.filter((r) => r.status === 'unmatched').length;
    return { exact, other, unmatched, total: keywordMatchResults.length };
  }, [keywordMatchResults]);

  const canSubmit = url.trim() !== '';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    // 발행일 = KST 자정 ISO. 비어있으면 null.
    let published_at: string | null = null;
    if (publishedDate) {
      const [y, m, d] = publishedDate.split('-').map(Number);
      // KST 자정 = UTC -9h
      published_at = new Date(Date.UTC(y, m - 1, d, -9, 0, 0)).toISOString();
    }
    await onSubmit({
      posting_url: url.trim(),
      title: title.trim() || null,
      blogger_id: effectiveBloggerId,
      program: program || null,
      target_keywords: parsedKeywords.length > 0 ? parsedKeywords : null,
      published_at,
      unit_price: unitPrice,
    });
  };

  const priceDisplay = unitPrice != null ? `${unitPrice.toLocaleString('ko-KR')}원` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? '포스팅 수정' : '포스팅 추가'}</DialogTitle>
          <DialogDescription>포스팅 URL을 입력하면 블로거 목록에서 자동 매칭됩니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="p-url">포스팅 URL *</Label>
            <div className="relative">
              <Input id="p-url" value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => fetchMeta(url)}
                placeholder="https://blog.naver.com/{블로거ID}/{포스트번호}" />
              {fetchingMeta && (
                <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {metaError && (
              <p className="text-xs text-amber-600">메타 자동 추출 실패: {metaError}. 제목·발행일을 직접 입력하세요.</p>
            )}
            {title && (
              <p className="text-xs text-muted-foreground truncate">
                📝 자동 추출: <span className="text-foreground font-medium">{title}</span>
              </p>
            )}
          </div>

          {/* 블로거 자동/수동 매칭 */}
          <div className="rounded-lg border p-3 bg-muted/30">
            {autoMatch ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>매칭됨: <strong>{autoMatch.name}</strong></span>
                <span className="text-muted-foreground">({autoMatch.blog_id})</span>
              </div>
            ) : url.trim() ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span>URL에 일치하는 블로거 없음. 수동으로 선택하거나 비워두세요.</span>
                </div>
                <Select value={manualBloggerId || 'none'}
                  onValueChange={(v) => setManualBloggerId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="블로거 선택 (선택)" /></SelectTrigger>
                  <SelectContent className="bg-popover max-h-72">
                    <SelectItem value="none">(블로거 미지정)</SelectItem>
                    {bloggers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({b.blog_id || b.blog_url})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">URL을 입력하면 매칭 결과가 표시됩니다.</p>
            )}
          </div>

          {/* 프로그램 + 업로드 날짜 + 단가 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>프로그램</Label>
              <Select value={program || 'none'}
                onValueChange={(v) => setProgram(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="프로그램 선택" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="none">(미지정)</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-published">업로드 날짜</Label>
              <Input id="p-published" type="date" value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-price">단가</Label>
              <Input id="p-price" value={priceDisplay}
                placeholder={effectiveBlogger?.unit_price != null
                  ? `블로거 기본 ${effectiveBlogger.unit_price.toLocaleString('ko-KR')}원`
                  : '예: 200000'}
                onChange={(e) => {
                  userTouchedPrice.current = true;
                  const digits = e.target.value.replace(/[^\d]/g, '');
                  setUnitPrice(digits === '' ? null : parseInt(digits, 10));
                }}
                inputMode="numeric" />
            </div>
          </div>

          {/* 의뢰 키워드 + 매칭 검증 */}
          <div className="space-y-2">
            <Label htmlFor="p-keywords">
              의뢰 키워드 <span className="text-xs text-muted-foreground">(쉼표 ',' 로 구분, 추적 키워드와 자동 매칭)</span>
            </Label>
            <Input id="p-keywords" value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="예: 화면캡쳐, 윈도우 캡쳐, 노트북 캡쳐" />

            {parsedKeywords.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {keywordMatchResults.map((r) => (
                    <Badge
                      key={r.keyword}
                      variant="outline"
                      className={
                        r.status === 'exact'
                          ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                          : r.status === 'other-program'
                          ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
                          : 'border-destructive/40 text-destructive bg-destructive/10'
                      }
                    >
                      {r.status === 'exact'
                        ? <CheckCircle2 className="w-3 h-3 mr-1" />
                        : <AlertTriangle className="w-3 h-3 mr-1" />}
                      {r.keyword}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  매칭 <strong className="text-emerald-700 dark:text-emerald-300">{matchSummary.exact}건</strong>
                  {matchSummary.other > 0 && (
                    <> · <strong className="text-amber-700 dark:text-amber-300">다른 프로그램 {matchSummary.other}건</strong></>
                  )}
                  {matchSummary.unmatched > 0 && (
                    <> · <strong className="text-destructive">미등록 {matchSummary.unmatched}건</strong> (해당 키워드를 "키워드 관리"에 먼저 등록하세요)</>
                  )}
                </p>
              </div>
            )}
          </div>

          {effectiveBlogger && (
            <p className="text-xs text-muted-foreground">
              저장 시 블로거 <strong>{effectiveBlogger.name}</strong>에 연결됩니다.
            </p>
          )}
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
  );
}
