import { useState, useMemo, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
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
import { format, subDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TrendChartTooltip } from './TrendChartTooltip';
import { TrendStatsCard } from './TrendStatsCard';
import type { CrawlResult } from '@/types/database';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const DATE_RANGES = [
  { value: '7', label: '최근 7일' },
  { value: '14', label: '최근 14일' },
  { value: '30', label: '최근 30일' },
];

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  [key: string]: string | number | undefined;
}

export function RankTrendChart() {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedEngineTab, setSelectedEngineTab] = useState<string>('all');
  const [dateRange, setDateRange] = useState('7');
  const [hoveredDate, setHoveredDate] = useState<string>('');

  const dateFrom = useMemo(() => {
    return subDays(new Date(), parseInt(dateRange)).toISOString();
  }, [dateRange]);

  const { data: results, isLoading } = useCrawlResults({
    search_engine_id: selectedEngineTab === 'all' ? undefined : selectedEngineTab,
    date_from: dateFrom,
  });
  const { data: keywords } = useKeywords();
  const { data: engines } = useSearchEngines();

  // Create a map for quick lookup of result details
  const resultDetailsMap = useMemo(() => {
    if (!results) return new Map<string, CrawlResult>();
    
    const map = new Map<string, CrawlResult>();
    results.forEach((r) => {
      const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
      const key = `${r.keyword_id}-${date}`;
      // Keep the best rank for each keyword per day
      const existing = map.get(key);
      if (!existing || r.rank < existing.rank) {
        map.set(key, r);
      }
    });
    return map;
  }, [results]);

  const getResultDetails = useCallback((keywordId: string, date: string): CrawlResult | undefined => {
    return resultDetailsMap.get(`${keywordId}-${date}`);
  }, [resultDetailsMap]);

  // Process data for chart
  const { chartData, keywordStats } = useMemo(() => {
    if (!results || results.length === 0) {
      return { chartData: [], keywordStats: {} };
    }

    // Get unique keywords from results
    const keywordMap = new Map<string, string>();
    results.forEach((r) => {
      if (r.keyword) {
        keywordMap.set(r.keyword_id, r.keyword.keyword);
      }
    });

    // Auto-select first 5 keywords if none selected
    const displayKeywords =
      selectedKeywords.length > 0
        ? selectedKeywords
        : Array.from(keywordMap.keys()).slice(0, 5);

    // Group by date and keyword
    const dateKeywordMap = new Map<string, Map<string, number[]>>();

    results
      .filter((r) => displayKeywords.includes(r.keyword_id))
      .forEach((r) => {
        const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
        if (!dateKeywordMap.has(date)) {
          dateKeywordMap.set(date, new Map());
        }
        const keywordRanks = dateKeywordMap.get(date)!;
        if (!keywordRanks.has(r.keyword_id)) {
          keywordRanks.set(r.keyword_id, []);
        }
        keywordRanks.get(r.keyword_id)!.push(r.rank);
      });

    // Calculate average rank per day per keyword
    const chartData: ChartDataPoint[] = [];
    const sortedDates = Array.from(dateKeywordMap.keys()).sort();

    sortedDates.forEach((date) => {
      const point: ChartDataPoint = {
        date,
        dateLabel: format(parseISO(date), 'MM/dd', { locale: ko }),
      };

      const keywordRanks = dateKeywordMap.get(date)!;
      displayKeywords.forEach((kwId) => {
        const ranks = keywordRanks.get(kwId);
        if (ranks && ranks.length > 0) {
          const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
          point[kwId] = Math.round(avg * 10) / 10;
        }
      });

      chartData.push(point);
    });

    // Calculate stats for each keyword
    const keywordStats: Record<string, { first: number; last: number; change: number }> = {};
    displayKeywords.forEach((kwId) => {
      const values = chartData
        .map((d) => d[kwId] as number | undefined)
        .filter((v): v is number => v !== undefined);
      
      if (values.length >= 2) {
        const first = values[0];
        const last = values[values.length - 1];
        keywordStats[kwId] = {
          first,
          last,
          change: first - last, // Positive = improved (lower rank is better)
        };
      }
    });

    return { chartData, keywordStats };
  }, [results, selectedKeywords]);

  // Get displayable keywords
  const displayKeywordIds = useMemo(() => {
    if (!results) return [];
    const ids = new Set<string>();
    results.forEach((r) => ids.add(r.keyword_id));
    return Array.from(ids);
  }, [results]);

  const getKeywordName = useCallback((id: string) => {
    return keywords?.find((k) => k.id === id)?.keyword || id;
  }, [keywords]);

  const handleKeywordToggle = (keywordId: string) => {
    setSelectedKeywords((prev) => {
      if (prev.includes(keywordId)) {
        return prev.filter((id) => id !== keywordId);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 keywords
      }
      return [...prev, keywordId];
    });
  };

  const activeKeywords = selectedKeywords.length === 0
    ? displayKeywordIds.slice(0, 5)
    : selectedKeywords;

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

  if (!results || results.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
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
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            reversed
            domain={[1, 'auto']}
            tick={{ fontSize: 12 }}
            label={{
              value: '순위',
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
                currentDate={hoveredDate}
              />
            }
          />
          <Legend
            formatter={(value) => getKeywordName(value)}
            wrapperStyle={{ paddingTop: '20px' }}
          />
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
              connectNulls
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
          <div className="flex flex-wrap gap-4 mb-4">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keyword Selection */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              키워드 선택 (최대 5개)
            </p>
            <div className="flex flex-wrap gap-2">
              {displayKeywordIds.map((kwId, index) => {
                const isSelected =
                  selectedKeywords.length === 0
                    ? index < 5
                    : selectedKeywords.includes(kwId);
                return (
                  <Badge
                    key={kwId}
                    variant={isSelected ? 'default' : 'outline'}
                    className="cursor-pointer transition-colors hover:opacity-80"
                    onClick={() => handleKeywordToggle(kwId)}
                    style={{
                      backgroundColor: isSelected
                        ? COLORS[
                            (selectedKeywords.length === 0
                              ? index
                              : selectedKeywords.indexOf(kwId)) % COLORS.length
                          ]
                        : undefined,
                    }}
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
            순위 변동 차트
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedEngineTab} onValueChange={setSelectedEngineTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">전체</TabsTrigger>
              {engines?.map((engine) => (
                <TabsTrigger key={engine.id} value={engine.id}>
                  {engine.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="all" className="mt-0">
              {renderChart()}
            </TabsContent>
            
            {engines?.map((engine) => (
              <TabsContent key={engine.id} value={engine.id} className="mt-0">
                {renderChart()}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {Object.keys(keywordStats).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {activeKeywords.map((kwId, index) => {
            const stats = keywordStats[kwId];
            if (!stats) return null;

            return (
              <TrendStatsCard
                key={kwId}
                keywordId={kwId}
                keywordName={getKeywordName(kwId)}
                stats={stats}
                color={COLORS[index % COLORS.length]}
                index={index}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
