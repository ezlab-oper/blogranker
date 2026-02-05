import { motion } from 'framer-motion';
import { ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCrawlResults } from '@/hooks/useCrawlResults';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

function getRankBadgeClass(rank: number) {
  if (rank === 1) return 'rank-badge rank-1';
  if (rank === 2) return 'rank-badge rank-2';
  if (rank === 3) return 'rank-badge rank-3';
  return 'rank-badge rank-default';
}

function getEngineBadge(name: string) {
  if (name === '네이버') {
    return <Badge className="bg-naver text-white border-0">네이버</Badge>;
  }
  return <Badge className="bg-google-blue text-white border-0">구글</Badge>;
}

export function RecentResults() {
  const { data: results, isLoading } = useCrawlResults();
  const recentResults = results?.slice(0, 10) || [];

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">최근 수집 결과</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg animate-shimmer" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentResults.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">최근 수집 결과</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>아직 수집된 데이터가 없습니다.</p>
            <p className="text-sm mt-1">키워드를 등록하고 수집을 시작하세요.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">최근 수집 결과</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentResults.map((result, index) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <span className={getRankBadgeClass(result.rank)}>{result.rank}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground truncate">
                    {result.keyword?.keyword}
                  </span>
                  {result.search_engine && getEngineBadge(result.search_engine.name)}
                </div>
                <p className="font-medium text-sm truncate">{result.blog_title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {result.blog_author} · {formatDistanceToNow(new Date(result.crawled_at), { addSuffix: true, locale: ko })}
                </p>
              </div>
              <a
                href={result.blog_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-background transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}