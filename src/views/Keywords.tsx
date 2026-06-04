import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, BarChart3, Loader2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { KeywordTable } from '@/components/keywords/KeywordTable';
import { KeywordDialog } from '@/components/keywords/KeywordDialog';
import { KeywordFilterBar } from '@/components/keywords/KeywordFilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useKeywords, useBulkSetKeywordsActive } from '@/hooks/useKeywords';
import { useKeywordSearchVolume } from '@/hooks/useKeywordSearchVolume';
import type { Keyword, KeywordCategory } from '@/types/database';

export default function Keywords() {
  const { canPerformActions } = useAuth();
  const { data: keywords } = useKeywords();
  const { data: searchVolumeData, isLoading: isLoadingVolume, fetchedAt, fetchSearchVolume } = useKeywordSearchVolume();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<(Keyword & { category: KeywordCategory | null }) | null>(null);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [bulkConfirm, setBulkConfirm] = useState<null | { is_active: boolean }>(null);
  const bulkSetActive = useBulkSetKeywordsActive();

  // 페이지 로드 시 검색량 자동 조회
  useEffect(() => {
    if (keywords && keywords.length > 0 && !fetchedAt && !isLoadingVolume) {
      const keywordStrings = keywords.map(kw => kw.keyword);
      fetchSearchVolume(keywordStrings);
    }
  }, [keywords]);

  const handleEdit = (keyword: Keyword & { category: KeywordCategory | null }) => {
    setEditData(keyword);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditData(null);
  };

  const handleFetchSearchVolume = () => {
    if (!keywords || keywords.length === 0) return;
    const keywordStrings = keywords.map(kw => kw.keyword);
    fetchSearchVolume(keywordStrings);
  };

  // 필터링된 키워드 목록
  const filteredKeywords = keywords?.filter(kw => {
    const programMatch = selectedPrograms.length === 0 || selectedPrograms.includes(kw.program || '');
    const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(kw.category?.name || '');
    return programMatch && categoryMatch;
  }) ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">키워드 관리</h1>
            <p className="text-muted-foreground mt-1">
              추적할 키워드를 등록하고 관리하세요
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setBulkConfirm({ is_active: true })}
              variant="outline"
              className="gap-2"
              disabled={!canPerformActions || bulkSetActive.isPending || filteredKeywords.length === 0}
            >
              <ToggleRight className="w-4 h-4 text-emerald-600" />
              모두 켜기
            </Button>
            <Button
              onClick={() => setBulkConfirm({ is_active: false })}
              variant="outline"
              className="gap-2"
              disabled={!canPerformActions || bulkSetActive.isPending || filteredKeywords.length === 0}
            >
              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
              모두 끄기
            </Button>
            <Button
              onClick={handleFetchSearchVolume}
              variant="outline"
              className="gap-2"
              disabled={isLoadingVolume || !keywords || keywords.length === 0}
            >
              {isLoadingVolume ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4" />
              )}
              검색량 조회
            </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              className="gradient-primary text-white gap-2"
              disabled={!canPerformActions}
            >
              <Plus className="w-4 h-4" />
              키워드 추가
            </Button>
          </div>
        </motion.div>

        {/* Filter Bar */}
        <KeywordFilterBar
          selectedPrograms={selectedPrograms}
          selectedCategories={selectedCategories}
          onProgramChange={setSelectedPrograms}
          onCategoryChange={setSelectedCategories}
        />

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="키워드 검색..." className="pl-10" />
          </div>
        </div>

        {/* Table */}
        <KeywordTable
          keywords={filteredKeywords}
          isLoading={!keywords}
          onEdit={handleEdit}
          readonly={!canPerformActions}
          searchVolumeData={searchVolumeData}
          fetchedAt={fetchedAt}
        />

        {/* Dialog */}
        <KeywordDialog open={dialogOpen} onOpenChange={handleDialogClose} editData={editData} />

        {/* Bulk activate/deactivate confirmation */}
        <AlertDialog open={!!bulkConfirm} onOpenChange={(o) => { if (!o) setBulkConfirm(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkConfirm?.is_active ? '키워드 일괄 활성화' : '키워드 일괄 비활성화'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                현재 필터 기준의 <strong>{filteredKeywords.length}개</strong> 키워드를{' '}
                {bulkConfirm?.is_active ? '활성화' : '비활성화'}합니다.
                {selectedPrograms.length === 0 && selectedCategories.length === 0
                  ? ' (필터 미적용 — 전체 키워드 대상)'
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!bulkConfirm) return;
                  await bulkSetActive.mutateAsync({
                    ids: filteredKeywords.map((k) => k.id),
                    is_active: bulkConfirm.is_active,
                  });
                  setBulkConfirm(null);
                }}
              >
                확인
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
