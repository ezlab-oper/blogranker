import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ResultsTable } from '@/components/results/ResultsTable';
import { Button } from '@/components/ui/button';

export default function Results() {
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
            <h1 className="text-3xl font-bold tracking-tight">수집 결과</h1>
            <p className="text-muted-foreground mt-1">
              키워드별 블로그 노출 현황을 확인하세요
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            CSV 내보내기
          </Button>
        </motion.div>

        {/* Results Table */}
        <ResultsTable />
      </div>
    </AppLayout>
  );
}