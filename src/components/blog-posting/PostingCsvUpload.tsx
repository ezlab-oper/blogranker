'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBulkAddPostings, type PostingInput } from '@/hooks/usePostings';
import { useBloggers } from '@/hooks/useBloggers';
import { extractBlogId } from '@/hooks/useBlogUrls';
import { PROGRAMS } from '@/components/keywords/KeywordFilterBar';

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

const HEADER_TEMPLATE = '포스팅URL,제목,프로그램,의뢰키워드';

export function PostingCsvUpload() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const bulkAdd = useBulkAddPostings();
  const { data: bloggers = [] } = useBloggers();
  const [parsing, setParsing] = useState(false);

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
      const iTitle = idx('제목');
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
        if (programRaw && !(PROGRAMS as readonly string[]).includes(programRaw)) {
          errors.push(`행 ${r + 1}: 프로그램 "${programRaw}" 허용 외. 허용: ${PROGRAMS.join('/')}`);
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

        inputs.push({
          posting_url: url,
          title: iTitle >= 0 ? (row[iTitle] || '').trim() || null : null,
          program: programRaw || null,
          target_keywords: target_keywords.length > 0 ? target_keywords : null,
          blogger_id: bloggerId,
          blog_id: blogId,
        });
      }

      if (errors.length > 0) {
        toast({
          title: '일부 행 오류',
          description: `${errors.length}개 행 제외. 첫 오류: ${errors[0]}`,
          variant: 'destructive',
        });
      }
      if (inputs.length === 0) return;

      const result = await bulkAdd.mutateAsync(inputs);
      const matched = inputs.filter((i) => i.blogger_id).length;
      const unmatched = inputs.length - matched;
      toast({
        title: 'CSV 업로드 완료',
        description: `${result.length}건 등록 (블로거 매칭 ${matched}건, 미매칭 ${unmatched}건).`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      // UNIQUE(posting_url) 위반 시 친절한 메시지
      const friendly = msg.includes('duplicate') || msg.includes('unique')
        ? 'CSV에 이미 등록된 URL이 포함돼 있어 일괄 삽입이 실패했습니다. 중복 URL 제거 후 재시도하세요.'
        : msg;
      toast({ title: 'CSV 업로드 실패', description: friendly, variant: 'destructive' });
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = HEADER_TEMPLATE + '\n' +
      'https://blog.naver.com/예시/123456789,예시 제목,이지캡쳐,화면캡쳐;윈도우 캡쳐\n';
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
        disabled={parsing || bulkAdd.isPending} className="gap-2">
        {(parsing || bulkAdd.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        CSV 업로드
      </Button>
      <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs gap-1">
        <AlertCircle className="w-3 h-3" />
        템플릿
      </Button>
    </div>
  );
}
