import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tags, FileText, Calendar, TrendingUp, Play, Loader2, Square } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentResults } from '@/components/dashboard/RecentResults';
import { KeywordOverview } from '@/components/dashboard/KeywordOverview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDashboardStats } from '@/hooks/useCrawlResults';
import { useKeywords } from '@/hooks/useKeywords';
import { runCrawlJob, cancelCrawlJob, CrawlProgress } from '@/lib/api/scraper';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function Dashboard() {
  const { canPerformActions } = useAuth();
  
  const { data: stats, isLoading } = useDashboardStats();
  const { data: keywords } = useKeywords();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);

  const handleStartCrawl = async () => {
    const activeKeywords = keywords?.filter(k => k.is_active) || [];
    
    if (activeKeywords.length === 0) {
      toast({
        title: '활성 키워드 없음',
        description: '수집할 활성 키워드가 없습니다. 키워드를 추가해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsCrawling(true);
    setCrawlProgress(null);

    toast({
      title: '수집 시작',
      description: `${activeKeywords.length}개 키워드 수집을 시작합니다.`,
    });

    try {
      const result = await runCrawlJob(
        activeKeywords.map(k => k.id),
        (progress) => setCrawlProgress(progress)
      );

      if (result.success) {
        toast({
          title: '수집 완료',
          description: '키워드 수집이 완료되었습니다.',
        });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['recent-results'] });
        queryClient.invalidateQueries({ queryKey: ['crawl-results'] });
      } else if (result.cancelled) {
        toast({
          title: '수집 취소됨',
          description: `수집이 취소되었습니다. (${crawlProgress?.processed || 0}/${crawlProgress?.total || 0} 완료)`,
        });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['recent-results'] });
        queryClient.invalidateQueries({ queryKey: ['crawl-results'] });
      } else {
        toast({
          title: '수집 실패',
          description: result.error || '수집 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Crawl error:', error);
      toast({
        title: '수집 오류',
        description: '수집 중 예상치 못한 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsCrawling(false);
      setCrawlProgress(null);
    }
  };

  const handleCancelCrawl = () => {
    cancelCrawlJob();
    toast({
      title: '취소 요청',
      description: '수집 취소를 요청했습니다. 현재 작업 완료 후 중단됩니다.',
    });
  };

  const progressPercent = crawlProgress 
    ? Math.round((crawlProgress.processed / crawlProgress.total) * 100) 
    : 0;

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
          <Button 
            className="gradient-primary text-white gap-2"
            onClick={handleStartCrawl}
            disabled={isCrawling || !canPerformActions}
          >
            {isCrawling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                수집 중...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                수집 시작
              </>
            )}
          </Button>
        </motion.div>

        {/* Crawl Progress */}
        {isCrawling && crawlProgress && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="font-medium">
                  수집 중: {crawlProgress.currentKeyword}
                </span>
                <span className="text-muted-foreground">
                  ({crawlProgress.currentEngine})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {crawlProgress.processed} / {crawlProgress.total}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelCrawl}
                  className="h-6 px-2 text-xs text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Square className="w-3 h-3 mr-1" />
                  취소
                </Button>
              </div>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>성공: {crawlProgress.successful} | 실패: {crawlProgress.failed}</span>
              <span>{progressPercent}%</span>
            </div>
          </motion.div>
        )}

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