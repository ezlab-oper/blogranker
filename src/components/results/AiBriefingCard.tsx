import { Sparkles, ExternalLink, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMatchType, type MatchType } from '@/hooks/useBlogUrls';
import type { CrawlResult } from '@/types/database';
import { cn } from '@/lib/utils';

interface Props {
  results: CrawlResult[];
  matchers: Parameters<typeof getMatchType>[1];
}

// AI 브리핑에 인용된 블로그(전체) — 순위와 별개, 우리(공식/협업) 블로그는 강조.
export function AiBriefingCard({ results, matchers }: Props) {
  if (!results || results.length === 0) return null;

  // rank(브리핑 내부 순서) 오름차순, URL 중복 제거
  const seen = new Set<string>();
  const rows = [...results]
    .sort((a, b) => a.rank - b.rank)
    .filter((r) => (seen.has(r.blog_url) ? false : (seen.add(r.blog_url), true)));

  return (
    <Card className="border-violet-500/30 bg-violet-500/5 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-violet-500" />
          AI 브리핑 노출 ({rows.length})
          <span className="text-xs font-normal text-muted-foreground">순위와 별개로 네이버 AI가 인용한 블로그</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const matchType: MatchType = getMatchType(r.blog_url, matchers);
          const isOurs = matchType === 'official_blog' || matchType === 'exact_url' || matchType === 'same_blog_id';
          return (
            <div
              key={r.id}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                matchType === 'official_blog' && 'bg-violet-500/15',
                matchType === 'exact_url' && 'bg-emerald-500/15',
                matchType === 'same_blog_id' && 'bg-sky-500/15',
                matchType === 'expired_blogger' && 'bg-red-500/10',
                !isOurs && matchType !== 'expired_blogger' && 'bg-background',
              )}
            >
              <span className={cn('font-medium line-clamp-1 flex-1', isOurs && 'text-foreground')}>
                {r.blog_title}
                {isOurs && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-700 dark:text-violet-300">
                    우리 블로그
                  </span>
                )}
              </span>
              {r.blog_author && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  {r.blog_author}
                </span>
              )}
              <a href={r.blog_url} target="_blank" rel="noopener noreferrer"
                className="p-1 rounded hover:bg-muted">
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
