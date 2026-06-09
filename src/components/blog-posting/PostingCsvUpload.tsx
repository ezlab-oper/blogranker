'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBulkAddPostings, type PostingInput } from '@/hooks/usePostings';
import { useBloggers } from '@/hooks/useBloggers';
import { extractBlogId } from '@/hooks/useBlogUrls';
import { usePrograms } from '@/hooks/usePrograms';
import { supabase } from '@/integrations/supabase/client';

// fetch-post-meta 일괄 호출용. 한 번에 N개 chunk 병렬, 실패 시 null.
const FETCH_CHUNK = 8;

async function fetchMetaSafe(url: string): Promise<{ title: string | null; published_at: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-post-meta', { body: { url } });
    if (error || !data?.success) return { title: null, published_at: null };
    return { title: data.title ?? null, published_at: data.published_at ?? null };
  } catch {
    return { title: null, published_at: null };
  }
}

// CSV 파서 (이중 따옴표·CRLF 처리)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

const HEADER_TEMPLATE = '포스팅URL,업로드날짜,프로그램,의뢰키워드';

// 'YYYY-MM-DD' (또는 'YYYY/MM/DD', 'YYYY.MM.DD') → KST 자정 ISO. 빈 값은 null.
function parsePublishedDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), -9, 0, 0)).toISOString();
}

export function PostingCsvUpload() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const bulkAdd = useBulkAddPostings();
  const { data: bloggers = [] } = useBloggers();
  const { data: programs = [] } = usePrograms();
  const allowedProgramNames = programs.map((p) => p.name);
  const [parsing, setParsing] = useState(false);
  const [metaProgress, setMetaProgress] = useState<{ done: number; total: number } | null>(null);

  // blog_id → blogger.id 매칭용
  const bloggerIdByBlogId = new Map<string, string>();
  for (const b of bloggers) if (b.blog_id) bloggerIdByBlogId.set(b.blog_id, b.id);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
      if (rows.length < 2) throw new Error('헤더 + 최소 1행이 필요합니다.');

      const header = rows[0].map((h) => h.trim());
      const idx = (k: string) => header.findIndex((h) => h === k);
      const iUrl = idx('포스팅URL');
      if (iUrl < 0) throw new Error(`헤더에 "포스팅URL"이 필수. 권장 헤더: ${HEADER_TEMPLATE}`);
      // 호환: 옛 '제목' 열은 무시(자동 추출로 대체).
      const iPublished = idx('업로드날짜');
      const iProgram = idx('프로그램');
      const iKeywords = idx('의뢰키워드');

      const inputs: PostingInput[] = [];
      const errors: string[] = [];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const url = (row[iUrl] || '').trim();
        if (!url) {
          errors.push(`행 ${r + 1}: 포스팅URL 비어있음`);
          continue;
        }
        if (!url.startsWith('http')) {
          errors.push(`행 ${r + 1}: URL 형식 오류 (${url.slice(0, 30)}...)`);
          continue;
        }

        const programRaw = iProgram >= 0 ? (row[iProgram] || '').trim() : '';
        if (programRaw && !allowedProgramNames.includes(programRaw)) {
          errors.push(`행 ${r + 1}: 프로그램 "${programRaw}" 허용 외. 허용: ${allowedProgramNames.join('/') || '(등록된 프로그램 없음)'}`);
          continue;
        }

        // 의뢰 키워드 분리 — 셀 내부는 `;` 또는 `|`로 구분 (CSV 컴마 충돌 회피)
        const kwRaw = iKeywords >= 0 ? (row[iKeywords] || '').trim() : '';
        const target_keywords = kwRaw
          ? Array.from(new Set(
              kwRaw.split(/[;|]/).map((s) => s.trim()).filter(Boolean)
            ))
          : [];

        // URL → blog_id → 블로거 자동 매칭
        const blogId = extractBlogId(url);
        const bloggerId = blogId ? bloggerIdByBlogId.get(blogId) ?? null : null;

        let publishedIso: string | null = null;
        if (iPublished >= 0) {
          const rawDate = (row[iPublished] || '').trim();
          if (rawDate) {
            publishedIso = parsePublishedDate(rawDate);
            if (!publishedIso) {
              errors.push(`행 ${r + 1}: 업로드날짜 형식 오류 "${rawDate}" (YYYY-MM-DD 권장)`);
              continue;
            }
          }
        }

        inputs.push({
          posting_url: url,
          title: null, // 제목은 자동 추출(추가 모달에서 fetch-post-meta)에 위임
          program: programRaw || null,
          target_keywords: target_keywords.length > 0 ? target_keywords : null,
          blogger_id: bloggerId,
          blog_id: blogId,
          published_at: publishedIso,
        });
      }

      // CSV 내부 중복 URL 제거 — 첫 번째 행만 유지, 이후는 무시.
      const seenUrls = new Set<string>();
      const deduped: PostingInput[] = [];
      let droppedDupCount = 0;
      for (const inp of inputs) {
        if (seenUrls.has(inp.posting_url)) {
          droppedDupCount++;
          continue;
        }
        seenUrls.add(inp.posting_url);
        deduped.push(inp);
      }

      if (errors.length > 0) {
        toast({
          title: '일부 행 오류',
          description: `${errors.length}개 행 제외. 첫 오류: ${errors[0]}`,
          variant: 'destructive',
        });
      }
      if (droppedDupCount > 0) {
        toast({
          title: '중복 URL 제외',
          description: `CSV 내부에서 중복된 URL ${droppedDupCount}건은 첫 번째 행만 유지하고 이후 행은 무시했습니다.`,
        });
      }
      if (deduped.length === 0) return;

      // fetch-post-meta로 제목·발행일 일괄 자동 추출.
      // - 제목은 항상 fetch 결과로 덮음(CSV에 제목 컬럼 없음).
      // - 발행일은 CSV 값 우선(있으면 그대로), 없을 때만 fetch 결과 사용.
      setMetaProgress({ done: 0, total: deduped.length });
      let titleHits = 0;
      let publishedHits = 0;
      for (let i = 0; i < deduped.length; i += FETCH_CHUNK) {
        const slice = deduped.slice(i, i + FETCH_CHUNK);
        const metas = await Promise.all(slice.map((d) => fetchMetaSafe(d.posting_url)));
        metas.forEach((meta, j) => {
          const target = deduped[i + j];
          if (meta.title) {
            target.title = meta.title;
            titleHits++;
          }
          if (!target.published_at && meta.published_at) {
            target.published_at = meta.published_at;
            publishedHits++;
          }
        });
        setMetaProgress({ done: Math.min(i + FETCH_CHUNK, deduped.length), total: deduped.length });
      }
      setMetaProgress(null);

      const result = await bulkAdd.mutateAsync(deduped);
      const matched = deduped.filter((i) => i.blogger_id).length;
      const unmatched = deduped.length - matched;
      toast({
        title: 'CSV 업로드 완료',
        description: `${result.length}건 등록·갱신 (블로거 매칭 ${matched}/미매칭 ${unmatched}, 제목 자동 추출 ${titleHits}/발행일 자동 보강 ${publishedHits}${droppedDupCount > 0 ? `, 중복 ${droppedDupCount}건 제외` : ''}). 같은 URL이 DB에 있었다면 새 값으로 덮어썼습니다.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      toast({ title: 'CSV 업로드 실패', description: msg, variant: 'destructive' });
    } finally {
      setParsing(false);
      setMetaProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = HEADER_TEMPLATE + '\n' +
      'https://blog.naver.com/예시/123456789,2026-06-04,이지캡쳐,화면캡쳐;윈도우 캡쳐\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'postings_template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <Button variant="outline" onClick={() => inputRef.current?.click()}
        disabled={parsing || bulkAdd.isPending || !!metaProgress} className="gap-2">
        {(parsing || bulkAdd.isPending || metaProgress) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {metaProgress
          ? `메타 추출 ${metaProgress.done}/${metaProgress.total}`
          : 'CSV 업로드'}
      </Button>
      <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs gap-1">
        <AlertCircle className="w-3 h-3" />
        템플릿
      </Button>
    </div>
  );
}
