import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2, Square } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { ResultsTable } from '@/components/results/ResultsTable';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useApiTracking } from '@/hooks/useApiTracking';
import { useKeywords } from '@/hooks/useKeywords';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { runCrawlJob, cancelCrawlJob, CrawlProgress } from '@/lib/api/scraper';

export default function Results() {
  useApiTracking('results');
  const { canPerformActions } = useAuth();
  const { data: keywords } = useKeywords();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress | null>(null);

  const handleStartCrawl = async () => {
    const activeKeywords = keywords?.filter(k => k.is_active) || [];
    if (activeKeywords.length === 0) {
      toast({ title: '활성 키워드 없음', description: '수집할 활성 키워드가 없습니다.', variant: 'destructive' });
      return;
    }
    setIsCrawling(true);
    setCrawlProgress(null);
    toast({ title: '수집 시작', description: `${activeKeywords.length}개 키워드 수집을 시작합니다.` });

    try {
      const result = await runCrawlJob(activeKeywords.map(k => k.id), (p) => setCrawlProgress(p));
      if (result.success) {
        toast({ title: '수집 완료', description: '키워드 수집이 완료되었습니다.' });
      } else if (result.cancelled) {
        toast({ title: '수집 취소됨', description: '수집이 취소되었습니다.' });
      } else {
        toast({ title: '수집 실패', description: result.error || '오류가 발생했습니다.', variant: 'destructive' });
      }
      queryClient.invalidateQueries({ queryKey: ['crawl_results'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    } catch (error) {
      console.error('Crawl error:', error);
      toast({ title: '수집 오류', description: '예상치 못한 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsCrawling(false);
      setCrawlProgress(null);
    }
  };

  const handleCancelCrawl = () => {
    cancelCrawlJob();
    toast({ title: '취소 요청', description: '현재 작업 완료 후 중단됩니다.' });
  };

  const progressPercent = crawlProgress
    ? Math.round((crawlProgress.processed / crawlProgress.total) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">수집 결과</h1>
            <p className="text-muted-foreground">
              키워드별 블로그 노출 현황을 확인하세요
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
                <span className="font-medium">{crawlProgress.currentKeyword}</span>
                <span className="text-muted-foreground">({crawlProgress.currentEngine})</span>
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

        {/* Results Table */}
        <ResultsTable />
      </div>
    </AppLayout>
  );
}
