import { useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, PowerOff, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useKeywords, useUpdateKeyword, useDeleteKeyword } from '@/hooks/useKeywords';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Keyword, KeywordCategory } from '@/types/database';
import type { KeywordSearchVolume } from '@/hooks/useKeywordSearchVolume';

interface KeywordTableProps {
  keywords: (Keyword & { category: KeywordCategory | null })[];
  isLoading: boolean;
  onEdit: (keyword: Keyword & { category: KeywordCategory | null }) => void;
  readonly?: boolean;
  searchVolumeData?: Record<string, KeywordSearchVolume>;
  fetchedAt?: Date | null;
}

function formatCount(value: number | string | undefined): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'string' && value === '< 10') return '< 10';
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString();
}

export function KeywordTable({ keywords, isLoading, onEdit, readonly = false, searchVolumeData, fetchedAt }: KeywordTableProps) {
  const updateKeyword = useUpdateKeyword();
  const deleteKeyword = useDeleteKeyword();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleToggleActive = (id: string, currentValue: boolean) => {
    updateKeyword.mutate({ id, is_active: !currentValue });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteKeyword.mutate(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const hasVolumeData = searchVolumeData && Object.keys(searchVolumeData).length > 0;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg animate-shimmer" />
        ))}
      </div>
    );
  }

  if (!keywords || keywords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>등록된 키워드가 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">상태</TableHead>
              <TableHead>키워드</TableHead>
              <TableHead>프로그램</TableHead>
              <TableHead>카테고리</TableHead>
              {hasVolumeData && (
              <>
                <TableHead className="text-right">PC 검색수</TableHead>
                <TableHead className="text-right">모바일 검색수</TableHead>
                <TableHead className="text-right">PC 클릭수</TableHead>
                <TableHead className="text-right">모바일 클릭수</TableHead>
                <TableHead className="text-center">경쟁정도</TableHead>
                <TableHead>조회일시</TableHead>
              </>
              )}
              <TableHead>등록일</TableHead>
              <TableHead className="text-right w-20">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {keywords.map((kw, index) => {
                const volume = searchVolumeData?.[kw.keyword.toLowerCase()];
                const pcCount = volume?.monthlyPcQcCnt;
                const mobileCount = volume?.monthlyMobileQcCnt;
                const pcClick = volume?.monthlyAvePcClkCnt;
                const mobileClick = volume?.monthlyAveMobileClkCnt;
                const compIdx = volume?.compIdx;

                return (
                  <motion.tr
                    key={kw.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.02 }}
                    className="group"
                  >
                    <TableCell>
                      <Switch
                        checked={kw.is_active}
                        onCheckedChange={() => handleToggleActive(kw.id, kw.is_active)}
                        className="data-[state=checked]:bg-success"
                        disabled={readonly}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {kw.is_active ? (
                          <Power className="w-4 h-4 text-success" />
                        ) : (
                          <PowerOff className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{kw.keyword}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{kw.program || '-'}</span>
                    </TableCell>
                    <TableCell>
                      {kw.category ? (
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: `${kw.category.color}20`,
                            color: kw.category.color,
                            borderColor: `${kw.category.color}40`,
                          }}
                          className="border"
                        >
                          {kw.category.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    {hasVolumeData && (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(pcCount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(mobileCount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {pcClick !== undefined ? pcClick.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {mobileClick !== undefined ? mobileClick.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {compIdx ? (
                            <Badge
                              variant="outline"
                              className={
                                compIdx === '높음'
                                  ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
                                  : compIdx === '중간'
                                  ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                              }
                            >
                              {compIdx}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {fetchedAt ? format(fetchedAt, 'yyyy-MM-dd HH:mm:ss') : '-'}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(kw.created_at), { addSuffix: true, locale: ko })}
                    </TableCell>
                    <TableCell className="text-right">
                      {!readonly && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(kw)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(kw.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>키워드를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 해당 키워드와 관련된 모든 수집 데이터가 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
