import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import type { CrawlResult } from '@/types/database';

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
}

interface TrendChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  getKeywordName: (id: string) => string;
  getResultDetails: (keywordId: string, date: string) => CrawlResult | undefined;
  currentDate: string;
}

export function TrendChartTooltip({
  active,
  payload,
  label,
  getKeywordName,
  getResultDetails,
  currentDate,
}: TrendChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[280px]">
      <p className="font-medium text-sm text-muted-foreground mb-2">
        📅 {label}
      </p>
      <div className="space-y-3">
        {payload.map((entry) => {
          const keywordName = getKeywordName(entry.dataKey);
          const details = getResultDetails(entry.dataKey, currentDate);

          return (
            <div
              key={entry.dataKey}
              className="border-l-2 pl-2"
              style={{ borderColor: entry.color }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate max-w-[180px]">
                  {keywordName}
                </span>
                <span
                  className="font-bold text-sm"
                  style={{ color: entry.color }}
                >
                  {entry.value}위
                </span>
              </div>
              {details && (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-muted-foreground truncate">
                    📝 {details.blog_title}
                  </p>
                  {details.blog_author && (
                    <p className="text-xs text-muted-foreground">
                      ✍️ {details.blog_author}
                    </p>
                  )}
                  <a
                    href={details.blog_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    블로그 방문
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
