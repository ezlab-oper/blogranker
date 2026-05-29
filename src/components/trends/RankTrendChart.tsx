import { useState, useMemo, useCallback, useEffect } from 'react';
import { TrendingUp, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCrawlResults, useSearchEngines } from '@/hooks/useCrawlResults';
import { useKeywords } from '@/hooks/useKeywords';
import { useBloggers } from '@/hooks/useBloggers';
import { useBlogUrls, OFFICIAL_BLOG_ID, extractBlogId } from '@/hooks/useBlogUrls';
import { format, subDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TrendChartTooltip, type RankPoint } from './TrendChartTooltip';
import { extractBlogId as extractBid } from '@/hooks/useBlogUrls';
import type { CrawlResult } from '@/types/database';

// 차트 라인·키워드 칩 공용 색상
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
];

const DATE_RANGES = [
  { value: '7', label: '최근 7일' },
  { value: '14', label: '최근 14일' },
  { value: '30', label: '최근 30일' },
];

type Scope = 'all' | 'official' | 'partner';
const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'all', label: '전체 (공식+협업)' },
  { value: 'official', label: '공식블로그만' },
  { value: 'partner', label: '협업만' },
];

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  [key: string]: string | number | undefined;
}

export function RankTrendChart() {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedEngineTab, setSelectedEngineTab] = useState<string>('');
  const [dateRange, setDateRange] = useState('14');
  const [scope, setScope] = useState<Scope>('all');
  const [hoveredDate, setHoveredDate] = useState<string>('');
  const [pinnedDate, setPinnedDate] = useState<string>('');

  const cutoffIso = useMemo(
    () => subDays(new Date(), parseInt(dateRange)).toISOString(),
    [dateRange]
  );

  const { data: results, isLoading } = useCrawlResults({ latestOnly: false });
  const { data: keywords } = useKeywords();
  const { data: engines } = useSearchEngines();
  const { data: bloggers = [] } = useBloggers();
  const { data: blogUrls = [] } = useBlogUrls();

  // 우리 측 blog_id 집합: 공식블로그 + 협업 블로거 + 시트 동기화 blog_urls
  const ourBlogIds = useMemo(() => {
    const s = new Set<string>();
    s.add(OFFICIAL_BLOG_ID);
    bloggers.forEach((b) => b.blog_id && s.add(b.blog_id));
    blogUrls.forEach((u) => u.blog_id && s.add(u.blog_id));
    return s;
  }, [bloggers, blogUrls]);

  // 결과 1건이 "우리 측"이고 스코프에 부합하는지
  const isInScope = useCallback(
    (r: CrawlResult): boolean => {
      const bid = extractBlogId(r.blog_url);
      if (!bid) return false;
      if (scope === 'official') return bid === OFFICIAL_BLOG_ID;
      if (scope === 'partner') return ourBlogIds.has(bid) && bid !== OFFICIAL_BLOG_ID;
      return ourBlogIds.has(bid);
    },
    [ourBlogIds, scope]
  );

  // 엔진 정렬: 네이버 → 구글 → 그 외
  const orderedEngines = useMemo(() => {
    if (!engines) return [];
    const naver = engines.find((e) => e.name === '네이버');
    const google = engines.find((e) => e.name === '구글');
    const others = engines.filter((e) => e.name !== '네이버' && e.name !== '구글');
    return [naver, google, ...others].filter((e): e is NonNullable<typeof e> => !!e);
  }, [engines]);

  // 엔진 로드되면 첫 번째(네이버)로 초기 선택
  useEffect(() => {
    if (!selectedEngineTab && orderedEngines.length > 0) {
      setSelectedEngineTab(orderedEngines[0].id);
    }
  }, [orderedEngines, selectedEngineTab]);

  // 우리 측 + 기간 + 엔진 필터 ('전체' 탭 제거됨 → 항상 단일 엔진 필터)
  const ourResults = useMemo(() => {
    if (!results || !selectedEngineTab) return [];
    return results.filter((r) => {
      if (r.crawled_at < cutoffIso) return false;
      if (r.search_engine_id !== selectedEngineTab) return false;
      return isInScope(r);
    });
  }, [results, cutoffIso, selectedEngineTab, isInScope]);

  // 블로거 lookup map (blog_id → Blogger, 닉네임 표시용)
  const bloggerByBlogId = useMemo(() => {
    const m = new Map<string, typeof bloggers[number]>();
    bloggers.forEach((b) => {
      if (b.blog_id) m.set(b.blog_id, b);
    });
    return m;
  }, [bloggers]);

  // 키워드별 (날짜 → 최저순위) 맵 — 7일 추이용
  const recentRanksByKeyword = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    ourResults.forEach((r) => {
      const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
      if (!map.has(r.keyword_id)) map.set(r.keyword_id, new Map());
      const m = map.get(r.keyword_id)!;
      const prev = m.get(date);
      if (prev === undefined || r.rank < prev) m.set(date, r.rank);
    });
    return map;
  }, [ourResults]);

  // currentDate 기준으로 N일 전~당일 추이 (데이터 있는 날만)
  const getRankTrajectory = useCallback(
    (kwId: string, endDate: string, days: number): RankPoint[] => {
      const m = recentRanksByKeyword.get(kwId);
      if (!m || !endDate) return [];
      const end = parseISO(endDate);
      const startMs = end.getTime() - (days - 1) * 24 * 60 * 60 * 1000;
      const points: RankPoint[] = [];
      for (const [date, rank] of m.entries()) {
        const ts = parseISO(date).getTime();
        if (ts >= startMs && ts <= end.getTime()) points.push({ date, rank });
      }
      return points.sort((a, b) => a.date.localeCompare(b.date));
    },
    [recentRanksByKeyword]
  );

  // 키워드 × 날짜 → 우리 측의 최저(최고) 순위 + 디테일
  const resultDetailsMap = useMemo(() => {
    const map = new Map<string, CrawlResult>();
    ourResults.forEach((r) => {
      const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
      const key = `${r.keyword_id}-${date}`;
      const existing = map.get(key);
      if (!existing || r.rank < existing.rank) map.set(key, r);
    });
    return map;
  }, [ourResults]);

  const getResultDetails = useCallback(
    (keywordId: string, date: string): CrawlResult | undefined =>
      resultDetailsMap.get(`${keywordId}-${date}`),
    [resultDetailsMap]
  );

  // 우리 결과가 한 번이라도 등장한 키워드만 표시 대상
  const displayKeywordIds = useMemo(() => {
    const ids = new Set<string>();
    ourResults.forEach((r) => ids.add(r.keyword_id));
    return Array.from(ids);
  }, [ourResults]);

  // 활성 키워드(선택값 우선, 미선택 시 자동 5개)
  const activeKeywords = useMemo(
    () => (selectedKeywords.length === 0 ? displayKeywordIds.slice(0, 5) : selectedKeywords),
    [selectedKeywords, displayKeywordIds]
  );

  const getKeywordName = useCallback(
    (id: string) => keywords?.find((k) => k.id === id)?.keyword || id,
    [keywords]
  );

  // 차트 데이터
  const { chartData, keywordStats } = useMemo(() => {
    if (ourResults.length === 0) {
      return { chartData: [], keywordStats: {} as Record<string, { first: number; last: number; change: number }> };
    }

    // 날짜별 키워드별 최저 rank
    const dateKwRank = new Map<string, Map<string, number>>();
    ourResults.forEach((r) => {
      if (!activeKeywords.includes(r.keyword_id)) return;
      const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
      if (!dateKwRank.has(date)) dateKwRank.set(date, new Map());
      const m = dateKwRank.get(date)!;
      const prev = m.get(r.keyword_id);
      if (prev === undefined || r.rank < prev) m.set(r.keyword_id, r.rank);
    });

    const sortedDates = Array.from(dateKwRank.keys()).sort();
    const data: ChartDataPoint[] = sortedDates.map((date) => {
      const point: ChartDataPoint = {
        date,
        dateLabel: format(parseISO(date), 'MM/dd', { locale: ko }),
      };
      const m = dateKwRank.get(date)!;
      activeKeywords.forEach((kwId) => {
        const v = m.get(kwId);
        if (v !== undefined) point[kwId] = v;
      });
      return point;
    });

    // 키워드별 통계: 첫/마지막 등장 + 변화량
    const stats: Record<string, { first: number; last: number; change: number }> = {};
    activeKeywords.forEach((kwId) => {
      const values = data
        .map((d) => d[kwId] as number | undefined)
        .filter((v): v is number => v !== undefined);
      if (values.length >= 1) {
        const first = values[0];
        const last = values[values.length - 1];
        stats[kwId] = { first, last, change: first - last }; // 양수 = 개선
      }
    });

    return { chartData: data, keywordStats: stats };
  }, [ourResults, activeKeywords]);

  const handleKeywordToggle = (kwId: string) => {
    setSelectedKeywords((prev) => {
      if (prev.includes(kwId)) return prev.filter((id) => id !== kwId);
      if (prev.length >= 5) return prev;
      return [...prev, kwId];
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-16">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // 빈 상태
  if (!results || results.length === 0 || displayKeywordIds.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            협업·공식블로그 순위 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <TrendingUp className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">기간 내 우리 측 순위 진입 데이터가 없습니다</p>
            <p className="text-sm mt-1 text-center">
              "블로거 목록"에 협업 블로거를 등록하거나, "키워드 수집"을 실행해보세요.<br />
              스코프를 "공식블로그만/협업만"으로 좁히면 결과가 더 적을 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          onMouseMove={(e) => {
            if (e?.activePayload?.[0]?.payload?.date) {
              setHoveredDate(e.activePayload[0].payload.date);
            }
          }}
          onClick={(e: any) => {
            const d = e?.activePayload?.[0]?.payload?.date;
            if (d) setPinnedDate(d);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} className="text-muted-foreground" />
          <YAxis
            reversed
            domain={[1, 10]}
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            label={{
              value: '순위(낮을수록 상위)',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fontSize: 12 },
            }}
            className="text-muted-foreground"
          />
          <Tooltip
            content={
              <TrendChartTooltip
                getKeywordName={getKeywordName}
                getResultDetails={getResultDetails}
                getRankTrajectory={getRankTrajectory}
                bloggerByBlogId={bloggerByBlogId}
                currentDate={hoveredDate}
              />
            }
          />
          <Legend formatter={(value) => getKeywordName(value)} wrapperStyle={{ paddingTop: '20px' }} />
          {activeKeywords.map((kwId, index) => (
            <Line
              key={kwId}
              type="monotone"
              dataKey={kwId}
              name={kwId}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {SCOPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              우리 측 = 공식블로그(ezlab_official) + 협업 블로거 + 시트 동기화 URL
            </span>
          </div>

          {/* Keyword Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              키워드 선택 (최대 5개) — 우리 측 글이 등장한 키워드만 표시
            </p>
            <div className="flex flex-wrap gap-2">
              {displayKeywordIds.map((kwId, index) => {
                const isSelected =
                  selectedKeywords.length === 0 ? index < 5 : selectedKeywords.includes(kwId);
                const colorIdx =
                  (selectedKeywords.length === 0 ? index : selectedKeywords.indexOf(kwId)) % COLORS.length;
                const color = COLORS[colorIdx];
                return (
                  <Badge
                    key={kwId}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer transition-colors hover:opacity-80 border-2"
                    onClick={() => handleKeywordToggle(kwId)}
                    style={isSelected ? { backgroundColor: color, color: '#fff', borderColor: color } : undefined}
                  >
                    {getKeywordName(kwId)}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart with Engine Tabs */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            협업·공식블로그 순위 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedEngineTab} onValueChange={setSelectedEngineTab}>
            <TabsList className="mb-4">
              {orderedEngines.map((engine) => (
                <TabsTrigger key={engine.id} value={engine.id}>
                  {engine.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {orderedEngines.map((engine) => (
              <TabsContent key={engine.id} value={engine.id} className="mt-0">
                {renderChart()}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Pinned Date Detail Panel — 그래프 점 클릭 시 표시 */}
      {pinnedDate && (
        <PinnedRankPanel
          date={pinnedDate}
          activeKeywords={activeKeywords}
          getKeywordName={getKeywordName}
          getResultDetails={getResultDetails}
          getRankTrajectory={getRankTrajectory}
          bloggerByBlogId={bloggerByBlogId}
          onClose={() => setPinnedDate('')}
        />
      )}
    </div>
  );
}

// ---------- 핀 고정 상세 패널 ----------

interface PinnedPanelProps {
  date: string;
  activeKeywords: string[];
  getKeywordName: (id: string) => string;
  getResultDetails: (kwId: string, date: string) => CrawlResult | undefined;
  getRankTrajectory: (kwId: string, endDate: string, days: number) => RankPoint[];
  bloggerByBlogId: Map<string, { id: string; name: string; blog_id: string | null }>;
  onClose: () => void;
}

function buildHomeUrl(blogId: string, blogUrl: string): string {
  if (blogUrl.includes('blog.naver.com')) return `https://blog.naver.com/${blogId}`;
  if (blogUrl.includes('tistory.com')) return `https://${blogId}.tistory.com`;
  if (blogUrl.includes('velog.io')) return `https://velog.io/@${blogId}`;
  if (blogUrl.includes('brunch.co.kr')) return `https://brunch.co.kr/@${blogId}`;
  return blogUrl;
}

function PinnedRankPanel({
  date,
  activeKeywords,
  getKeywordName,
  getResultDetails,
  getRankTrajectory,
  bloggerByBlogId,
  onClose,
}: PinnedPanelProps) {
  // 그날 순위 있는 키워드만 + 순위 오름차순
  const rows = activeKeywords
    .map((kwId) => {
      const details = getResultDetails(kwId, date);
      if (!details) return null;
      return { kwId, details };
    })
    .filter((x): x is { kwId: string; details: CrawlResult } => !!x)
    .sort((a, b) => a.details.rank - b.details.rank);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            📅 {date} 상세
            <span className="text-xs font-normal text-muted-foreground">
              (그래프 점을 클릭해 다른 날짜로 전환)
            </span>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose} className="gap-1">
            <X className="w-4 h-4" />
            닫기
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">해당 날짜에 우리 측 진입 없음</p>
        ) : (
          <div className="divide-y">
            {rows.map(({ kwId, details }, idx) => {
              const blogId = extractBid(details.blog_url);
              const homeUrl = blogId ? buildHomeUrl(blogId, details.blog_url) : details.blog_url;
              const matched = blogId ? bloggerByBlogId.get(blogId) : undefined;
              const nickname = matched?.name ?? null;

              const rawTitle = details.blog_title?.trim();
              const sanitizedTitle =
                rawTitle && !/^https?:\/\//i.test(rawTitle) && !/^www\./i.test(rawTitle)
                  ? rawTitle
                  : null;

              const trajectory = getRankTrajectory(kwId, date, 7);
              const color = COLORS[idx % COLORS.length];

              return (
                <div key={kwId} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium text-sm truncate">{getKeywordName(kwId)}</span>
                    </div>
                    <span className="font-bold text-sm flex-shrink-0" style={{ color }}>
                      {details.rank}위
                    </span>
                  </div>

                  {/* 최근 7일 추이 */}
                  {trajectory.length >= 1 && (
                    <div className="mt-1.5 flex items-center flex-wrap gap-1 text-[11px] text-muted-foreground">
                      <span className="opacity-70">최근 7일:</span>
                      {trajectory.map((t, i) => {
                        const isCur = t.date === date;
                        return (
                          <span key={t.date} className="inline-flex items-center gap-1">
                            <span
                              className={isCur ? 'font-semibold' : 'opacity-80'}
                              style={isCur ? { color } : undefined}
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

                  <div className="mt-1.5 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      📝 {sanitizedTitle ?? <span className="italic opacity-70">(제목 없음)</span>}
                    </p>
                    {blogId && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">✍️ </span>
                        <a href={homeUrl} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium">
                          {nickname ?? blogId}
                        </a>
                        {nickname && <span className="text-muted-foreground"> ({blogId})</span>}
                      </p>
                    )}
                    <a href={details.blog_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      포스팅 열기
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
