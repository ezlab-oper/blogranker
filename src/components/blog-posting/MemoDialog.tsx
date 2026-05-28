'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  initialMemo?: string | null;
  title?: string;
  onSave: (memo: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function MemoDialog({ open, initialMemo, title = '메모', onSave, onOpenChange }: Props) {
  const [memo, setMemo] = useState(initialMemo || '');

  useEffect(() => {
    if (open) setMemo(initialMemo || '');
  }, [open, initialMemo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>블로거에 대한 메모를 자유롭게 작성하세요.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={8}
          placeholder="메모를 입력하세요..."
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => { onSave(memo); onOpenChange(false); }}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
