import { motion } from 'framer-motion';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

        {/* Placeholder */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              순위 변동 차트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <TrendingUp className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">데이터 수집 후 표시됩니다</p>
              <p className="text-sm mt-1">
                키워드를 등록하고 수집을 시작하면 순위 변동 추이를 확인할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}