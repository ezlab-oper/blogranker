import type { CrawlResult } from '@/types/database';
import type { Blogger } from '@/hooks/useBloggers';
import { extractBlogId } from '@/hooks/useBlogUrls';

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  // Recharts가 ChartDataPoint 전체를 payload로 함께 전달.
  // jitter 적용 전 원본 rank는 `_rank_<kwId>`에 저장돼 있어 그것을 우선 사용.
  payload?: Record<string, unknown>;
}

function getDisplayRank(entry: TooltipPayload): number {
  const orig = entry.payload?.[`_rank_${entry.dataKey}`];
  return typeof orig === 'number' ? orig : entry.value;
}

export interface RankPoint {
  date: string; // yyyy-MM-dd
  rank: number;
}

interface TrendChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  getKeywordName: (id: string) => string;
  getResultDetails: (keywordId: string, date: string) => CrawlResult | undefined;
  // 최근 N일 추이(currentDate 포함) — 오름차순 정렬, 데이터 없는 날은 제외
  getRankTrajectory: (keywordId: string, endDate: string, days: number) => RankPoint[];
  // blog_id → 매칭된 블로거(있으면 닉네임 사용). 계약 상태와 무관하게 모두 포함.
  bloggerByBlogId: Map<string, Blogger>;
  currentDate: string;
}

// blog_id에서 메인 홈 URL 생성
function buildBlogHomeUrl(blogId: string, blogUrl: string): string {
  if (blogUrl.includes('blog.naver.com')) return `https://blog.naver.com/${blogId}`;
  if (blogUrl.includes('tistory.com')) return `https://${blogId}.tistory.com`;
  if (blogUrl.includes('velog.io')) return `https://velog.io/@${blogId}`;
  if (blogUrl.includes('brunch.co.kr')) return `https://brunch.co.kr/@${blogId}`;
  return blogUrl;
}

export function TrendChartTooltip({
  active,
  payload,
  label,
  getKeywordName,
  getResultDetails,
  getRankTrajectory,
  bloggerByBlogId,
  currentDate,
}: TrendChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[300px] max-w-[420px]">
      <p className="font-medium text-sm text-muted-foreground mb-2">📅 {label}</p>

      <div className="space-y-3">
        {/* 순위 높은 항목(낮은 숫자)부터 정렬 */}
        {[...payload]
          .sort((a, b) => (getDisplayRank(a) ?? Infinity) - (getDisplayRank(b) ?? Infinity))
          .map((entry) => {
            const displayRank = getDisplayRank(entry);
            const keywordName = getKeywordName(entry.dataKey);
            const details = getResultDetails(entry.dataKey, currentDate);
            const trajectory = getRankTrajectory(entry.dataKey, currentDate, 7);

            let blogId: string | null = null;
            let blogHomeUrl = '';
            let bloggerNickname: string | null = null;
            if (details?.blog_url) {
              blogId = extractBlogId(details.blog_url);
              blogHomeUrl = blogId ? buildBlogHomeUrl(blogId, details.blog_url) : details.blog_url;
              if (blogId) {
                const matched = bloggerByBlogId.get(blogId);
                if (matched) bloggerNickname = matched.name;
              }
            }

            return (
              <div
                key={entry.dataKey}
                className="border-l-2 pl-2"
                style={{ borderColor: entry.color }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate max-w-[210px]">{keywordName}</span>
                  <span className="font-bold text-sm" style={{ color: entry.color }}>
                    {displayRank}위
                  </span>
                </div>

                {/* 최근 7일 추이 */}
                {trajectory.length >= 1 && (
                  <div className="mt-1 flex items-center flex-wrap gap-1 text-[11px] text-muted-foreground">
                    <span className="opacity-70">최근 7일:</span>
                    {trajectory.map((t, i) => {
                      const isCurrent = t.date === currentDate;
                      return (
                        <span key={t.date} className="inline-flex items-center gap-1">
                          <span
                            className={isCurrent ? 'font-semibold' : 'opacity-80'}
                            style={isCurrent ? { color: entry.color } : undefined}
                            title={t.date}
                          >
                            {t.rank}
                          </span>
                          {i < trajectory.length - 1 && <span className="opacity-50">→</span>}
                        </span>
                      );
                    })}
                  </div>
                )}

                {details && (() => {
                  const rawTitle = details.blog_title?.trim();
                  const sanitizedTitle =
                    rawTitle && !/^https?:\/\//i.test(rawTitle) && !/^www\./i.test(rawTitle)
                      ? rawTitle
                      : null;
                  return (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-xs text-muted-foreground truncate">
                        📝 {sanitizedTitle ?? <span className="italic opacity-70">(제목 없음)</span>}
                      </p>
                      {blogId && (
                        <p className="text-xs">
                          <span className="text-muted-foreground">✍️ </span>
                          <a
                            href={blogHomeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {bloggerNickname ?? blogId}
                          </a>
                          {bloggerNickname && (
                            <span className="text-muted-foreground"> ({blogId})</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
      </div>
    </div>
  );
}
