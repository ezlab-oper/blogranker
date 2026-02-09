import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, BarChart3, Loader2, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { KeywordTable } from '@/components/keywords/KeywordTable';
import { KeywordDialog } from '@/components/keywords/KeywordDialog';
import { KeywordFilterBar } from '@/components/keywords/KeywordFilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiTracking } from '@/hooks/useApiTracking';
import { useAuth } from '@/contexts/AuthContext';
import { useKeywords } from '@/hooks/useKeywords';
import { useKeywordSearchVolume } from '@/hooks/useKeywordSearchVolume';
import type { Keyword, KeywordCategory } from '@/types/database';

export default function Keywords() {
  useApiTracking('keywords');
  const { canPerformActions } = useAuth();
  const { data: keywords } = useKeywords();
  const { data: searchVolumeData, isLoading: isLoadingVolume, fetchedAt, fetchSearchVolume } = useKeywordSearchVolume();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<(Keyword & { category: KeywordCategory | null }) | null>(null);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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

  const handleFilterSearch = () => {
    // TODO: 필터 적용 로직 (프로그램/카테고리 기반 키워드 필터링)
    console.log('Filter search:', { selectedPrograms, selectedCategories });
  };

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
          <div className="flex gap-2">
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
          onSearch={handleFilterSearch}
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
          onEdit={handleEdit}
          readonly={!canPerformActions}
          searchVolumeData={searchVolumeData}
          fetchedAt={fetchedAt}
        />

        {/* Dialog */}
        <KeywordDialog open={dialogOpen} onOpenChange={handleDialogClose} editData={editData} />
      </div>
    </AppLayout>
  );
}
