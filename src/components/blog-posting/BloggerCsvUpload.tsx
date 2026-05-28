'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  BLOG_GRADE_OPTIONS, BLOGGER_STATUS_OPTIONS,
  useBulkAddBloggers,
  type BloggerInput, type BloggerStatus, type BlogGrade,
} from '@/hooks/useBloggers';

// 최소 CSV 파서 (이중 따옴표·CRLF 처리)
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

const HEADER_TEMPLATE = '블로거명,블로그URL,이메일,단가,상태,계약만료일,블로그지수,인플,메모';

export function BloggerCsvUpload() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const bulkAdd = useBulkAddBloggers();
  const [parsing, setParsing] = useState(false);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
      if (rows.length < 2) throw new Error('헤더 + 최소 1행이 필요합니다.');
      const header = rows[0].map((h) => h.trim());
      const expected = HEADER_TEMPLATE.split(',');
      // 헤더 누락 검증 (필수: 블로거명, 블로그URL)
      const idx = (key: string) => header.findIndex((h) => h === key);
      const iName = idx('블로거명'); const iUrl = idx('블로그URL');
      if (iName < 0 || iUrl < 0) {
        throw new Error(`헤더에 "블로거명"·"블로그URL"이 있어야 합니다. 권장 헤더: ${HEADER_TEMPLATE}`);
      }
      const iEmail = idx('이메일');
      const iPrice = idx('단가');
      const iStatus = idx('상태');
      const iDate = idx('계약만료일');
      const iGrade = idx('블로그지수');
      const iInf = idx('인플');
      const iMemo = idx('메모');

      const inputs: BloggerInput[] = [];
      const errors: string[] = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const name = (row[iName] || '').trim();
        const blog_url = (row[iUrl] || '').trim();
        if (!name || !blog_url) {
          errors.push(`행 ${r + 1}: 블로거명/블로그URL 비어있음`);
          continue;
        }
        const priceRaw = iPrice >= 0 ? (row[iPrice] || '').replace(/[^\d]/g, '') : '';
        const statusVal = iStatus >= 0 ? (row[iStatus] || '').trim() : '';
        const gradeVal = iGrade >= 0 ? (row[iGrade] || '').trim() : '';
        const infVal = iInf >= 0 ? (row[iInf] || '').trim() : '';
        const dateVal = iDate >= 0 ? (row[iDate] || '').trim() : '';

        if (statusVal && !BLOGGER_STATUS_OPTIONS.includes(statusVal as BloggerStatus)) {
          errors.push(`행 ${r + 1}: 상태값 "${statusVal}" 허용 외. 허용: ${BLOGGER_STATUS_OPTIONS.join('/')}`);
          continue;
        }
        if (gradeVal && !BLOG_GRADE_OPTIONS.includes(gradeVal as BlogGrade)) {
          errors.push(`행 ${r + 1}: 블로그지수 "${gradeVal}" 허용 외.`);
          continue;
        }

        inputs.push({
          name,
          blog_url,
          email: iEmail >= 0 ? (row[iEmail] || '').trim() || null : null,
          unit_price: priceRaw ? parseInt(priceRaw, 10) : null,
          status: (statusVal as BloggerStatus) || null,
          contract_end_date: dateVal || null,
          blog_grade: (gradeVal as BlogGrade) || null,
          is_influencer: infVal === '유',
          memo: iMemo >= 0 ? (row[iMemo] || '').trim() || null : null,
        });
      }

      if (errors.length > 0) {
        toast({
          title: '일부 행 오류',
          description: `${errors.length}개 행 오류. 첫 오류: ${errors[0]}`,
          variant: 'destructive',
        });
      }
      if (inputs.length === 0) return;

      const result = await bulkAdd.mutateAsync(inputs);
      toast({ title: 'CSV 업로드 완료', description: `${result.length}건 등록됨.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      toast({ title: 'CSV 업로드 실패', description: msg, variant: 'destructive' });
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = HEADER_TEMPLATE + '\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bloggers_template.csv';
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
        템플릿 다운로드
      </Button>
    </div>
  );
}
