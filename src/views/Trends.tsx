import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { RankTrendChart } from '@/components/trends/RankTrendChart';
import { AiBriefingTrend } from '@/components/trends/AiBriefingTrend';

export default function Trends() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold tracking-tight">순위 추이</h1>
          <p className="text-muted-foreground mt-1">
            키워드별 순위 변동을 분석하세요
          </p>
        </motion.div>

        {/* Rank Trend Chart */}
        <RankTrendChart />

        {/* AI 브리핑 노출 추이 */}
        <AiBriefingTrend />
      </div>
    </AppLayout>
  );
}