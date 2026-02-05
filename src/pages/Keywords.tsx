import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { KeywordTable } from '@/components/keywords/KeywordTable';
import { KeywordDialog } from '@/components/keywords/KeywordDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Keyword, KeywordCategory } from '@/types/database';

export default function Keywords() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editData, setEditData] = useState<(Keyword & { category: KeywordCategory | null }) | null>(null);

  const handleEdit = (keyword: Keyword & { category: KeywordCategory | null }) => {
    setEditData(keyword);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditData(null);
    }
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
          <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-white gap-2">
            <Plus className="w-4 h-4" />
            키워드 추가
          </Button>
        </motion.div>

        {/* Search (placeholder for future) */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="키워드 검색..." className="pl-10" />
          </div>
        </div>

        {/* Table */}
        <KeywordTable onEdit={handleEdit} />

        {/* Dialog */}
        <KeywordDialog open={dialogOpen} onOpenChange={handleDialogClose} editData={editData} />
      </div>
    </AppLayout>
  );
}