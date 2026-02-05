import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { ResultsTable } from '@/components/results/ResultsTable';

export default function Results() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-1"
        >
          <h1 className="text-3xl font-bold tracking-tight">수집 결과</h1>
          <p className="text-muted-foreground">
            키워드별 블로그 노출 현황을 확인하세요
          </p>
        </motion.div>

        {/* Results Table */}
        <ResultsTable />
      </div>
    </AppLayout>
  );
}