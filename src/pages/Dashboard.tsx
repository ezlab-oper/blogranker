import { motion } from 'framer-motion';
import { Tags, FileText, Calendar, TrendingUp, Play } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentResults } from '@/components/dashboard/RecentResults';
import { KeywordOverview } from '@/components/dashboard/KeywordOverview';
import { Button } from '@/components/ui/button';
import { useDashboardStats } from '@/hooks/useCrawlResults';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
            <p className="text-muted-foreground mt-1">
              블로그 검색 순위 추적 현황을 한눈에 확인하세요
            </p>
          </div>
          <Button className="gradient-primary text-white gap-2">
            <Play className="w-4 h-4" />
            수집 시작
          </Button>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="전체 키워드"
            value={isLoading ? '-' : stats?.totalKeywords || 0}
            subtitle={`활성 ${stats?.activeKeywords || 0}개`}
            icon={Tags}
            variant="primary"
            delay={0}
          />
          <StatCard
            title="수집된 결과"
            value={isLoading ? '-' : stats?.totalResults.toLocaleString() || 0}
            subtitle={`오늘 +${stats?.todayResults || 0}건`}
            icon={FileText}
            variant="success"
            delay={0.1}
          />
          <StatCard
            title="마지막 수집"
            value={
              isLoading
                ? '-'
                : stats?.lastCrawlDate
                ? format(new Date(stats.lastCrawlDate), 'MM/dd HH:mm', { locale: ko })
                : '없음'
            }
            subtitle="최근 수집 시간"
            icon={Calendar}
            variant="info"
            delay={0.2}
          />
          <StatCard
            title="평균 순위"
            value="-"
            subtitle="데이터 수집 후 표시"
            icon={TrendingUp}
            variant="warning"
            delay={0.3}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          <KeywordOverview />
          <RecentResults />
        </div>
      </div>
    </AppLayout>
  );
}