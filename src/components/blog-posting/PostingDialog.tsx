'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { extractBlogId } from '@/hooks/useBlogUrls';
import type { Blogger } from '@/hooks/useBloggers';
import type { Posting, PostingInput } from '@/hooks/usePostings';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Posting | null;
  bloggers: Blogger[];
  onSubmit: (input: PostingInput) => Promise<void> | void;
  isPending?: boolean;
}

export function PostingDialog({ open, onOpenChange, initial, bloggers, onSubmit, isPending }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [manualBloggerId, setManualBloggerId] = useState<string>(''); // 자동매칭 실패 시 수동 선택

  useEffect(() => {
    if (open) {
      setUrl(initial?.posting_url || '');
      setTitle(initial?.title || '');
      setManualBloggerId(initial?.blogger_id || '');
    }
  }, [open, initial]);

  // URL에서 blog_id 추출 → 블로거 자동 매칭
  const autoMatch = useMemo<Blogger | null>(() => {
    const blogId = extractBlogId(url);
    if (!blogId) return null;
    return bloggers.find((b) => b.blog_id === blogId) || null;
  }, [url, bloggers]);

  // 최종 적용될 블로거 ID: 자동매칭 우선, 없으면 수동 선택값
  const effectiveBloggerId = autoMatch?.id || manualBloggerId || null;
  const effectiveBlogger = autoMatch || bloggers.find((b) => b.id === manualBloggerId) || null;

  const canSubmit = url.trim() !== '';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      posting_url: url.trim(),
      title: title.trim() || null,
      blogger_id: effectiveBloggerId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? '포스팅 수정' : '포스팅 추가'}</DialogTitle>
          <DialogDescription>포스팅 URL을 입력하면 블로거 목록에서 자동 매칭됩니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="p-url">포스팅 URL *</Label>
            <Input id="p-url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://blog.naver.com/{블로거ID}/{포스트번호}" />
          </div>

          {/* 매칭 결과 */}
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

          <div className="space-y-2">
            <Label htmlFor="p-title">제목 (선택)</Label>
            <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="포스팅 제목" />
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
