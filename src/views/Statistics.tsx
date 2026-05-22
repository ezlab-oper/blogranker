import { useState } from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStatistics, DateRange } from '@/hooks/useStatistics';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  Target,
  FileText,
  CheckCircle2,
  PieChart,
  Activity,
  CalendarIcon,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type PresetKey = '7d' | '14d' | '30d' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'all';

interface DatePreset {
  key: PresetKey;
  label: string;
  getRange: () => DateRange | undefined;
}

const datePresets: DatePreset[] = [
  { key: 'all', label: '전체', getRange: () => undefined },
  { key: '7d', label: '최근 7일', getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { key: '14d', label: '최근 14일', getRange: () => ({ from: subDays(new Date(), 14), to: new Date() }) },
  { key: '30d', label: '최근 30일', getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { key: 'thisWeek', label: '이번 주', getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { key: 'thisMonth', label: '이번 달', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { key: 'lastMonth', label: '지난 달', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
];

function DateRangeFilter({
  dateRange,
  onDateRangeChange,
  activePreset,
  onPresetChange,
}: {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  activePreset: PresetKey;
  onPresetChange: (preset: PresetKey) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetClick = (preset: DatePreset) => {
    onPresetChange(preset.key);
    onDateRangeChange(preset.getRange());
  };

  const handleCustomDateSelect = (date: Date | undefined, type: 'from' | 'to') => {
    if (!date) return;
    
    onPresetChange('all'); // Clear preset when using custom date
    
    if (type === 'from') {
      onDateRangeChange({
        from: date,
        to: dateRange?.to || date,
      });
    } else {
      onDateRangeChange({
        from: dateRange?.from || date,
        to: date,
      });
    }
  };

  const clearDateRange = () => {
    onPresetChange('all');
    onDateRangeChange(undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1">
        {datePresets.map((preset) => (
          <Button
            key={preset.key}
            variant={activePreset === preset.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom date picker */}
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'justify-start text-left font-normal text-xs',
                !dateRange && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, 'MM/dd', { locale: ko })} -{' '}
                    {format(dateRange.to, 'MM/dd', { locale: ko })}
                  </>
                ) : (
                  format(dateRange.from, 'PP', { locale: ko })
                )
              ) : (
                <span>기간 선택</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex">
              <div className="border-r p-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 px-2">시작일</p>
                <Calendar
                  mode="single"
                  selected={dateRange?.from}
                  onSelect={(date) => handleCustomDateSelect(date, 'from')}
                  disabled={(date) => date > new Date()}
                  className="p-3 pointer-events-auto"
                />
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 px-2">종료일</p>
                <Calendar
                  mode="single"
                  selected={dateRange?.to}
                  onSelect={(date) => handleCustomDateSelect(date, 'to')}
                  disabled={(date) => 
                    date > new Date() || (dateRange?.from ? date < dateRange.from : false)
                  }
                  className="p-3 pointer-events-auto"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {dateRange && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearDateRange}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="p-3 rounded-xl bg-primary/10">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Statistics() {
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<PresetKey>('all');

  const {
    overview,
    engineStats,
    platformStats,
    dailyStats,
    rankDistribution,
    jobStats,
    isLoading,
  } = useStatistics(dateRange);

  const enginePieData = engineStats.map(e => ({
    name: e.engine_name,
    value: e.total_results,
  }));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">수집 통계</h1>
              <p className="text-muted-foreground mt-1">
                스크래핑 결과에 대한 상세 통계를 확인합니다
              </p>
            </div>
            <Badge variant="outline" className="gap-1">
              <Activity className="w-3 h-3" />
              {dateRange ? '기간 필터 적용됨' : '전체 기간'}
            </Badge>
          </div>

          {/* Date Filter */}
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            activePreset={activePreset}
            onPresetChange={setActivePreset}
          />
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="총 수집 건수"
                value={overview?.total_results.toLocaleString() || 0}
                icon={FileText}
                subtitle="전체 블로그 포스트"
              />
              <StatCard
                title="활성 키워드"
                value={overview?.total_keywords || 0}
                icon={Target}
                subtitle="모니터링 중"
              />
              <StatCard
                title="평균 순위"
                value={overview?.avg_rank || '-'}
                icon={TrendingUp}
                subtitle="전체 결과 기준"
              />
              <StatCard
                title="TOP 3 진입"
                value={overview?.top3_count.toLocaleString() || 0}
                icon={CheckCircle2}
                subtitle="1~3위 노출 건수"
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engine Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    검색엔진별 분포
                  </CardTitle>
                  <CardDescription>엔진별 수집 결과 비율</CardDescription>
                </CardHeader>
                <CardContent>
                  {enginePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RechartsPieChart>
                        <Pie
                          data={enginePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {enginePieData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      수집된 데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Platform Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    플랫폼별 분포
                  </CardTitle>
                  <CardDescription>블로그 플랫폼별 수집 건수</CardDescription>
                </CardHeader>
                <CardContent>
                  {platformStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={platformStats.slice(0, 6)}
                        layout="vertical"
                        margin={{ left: 20, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                        <YAxis
                          type="category"
                          dataKey="platform"
                          width={80}
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="hsl(var(--primary))"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      수집된 데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    일별 수집 추이
                  </CardTitle>
                  <CardDescription>
                    {dateRange
                      ? `${format(dateRange.from, 'yyyy.MM.dd')} ~ ${format(dateRange.to, 'yyyy.MM.dd')}`
                      : '전체 기간'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dailyStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                          }}
                        />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          labelFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString('ko-KR');
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="naver_count"
                          name="네이버"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="google_count"
                          name="구글"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      수집된 데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rank Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    순위 분포
                  </CardTitle>
                  <CardDescription>순위 구간별 결과 분포</CardDescription>
                </CardHeader>
                <CardContent>
                  {rankDistribution.some(r => r.count > 0) ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={rankDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="count" name="수집 건수" radius={[4, 4, 0, 0]}>
                          {rankDistribution.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={index === 0 ? '#10b981' : index === 1 ? '#f59e0b' : '#64748b'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      수집된 데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Job Stats Summary */}
            {jobStats && jobStats.total_jobs > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    크롤링 작업 현황
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{jobStats.total_jobs}</p>
                      <p className="text-sm text-muted-foreground">전체 작업</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-emerald-500/10">
                      <p className="text-2xl font-bold text-emerald-600">{jobStats.successful_jobs}</p>
                      <p className="text-sm text-muted-foreground">완료</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-amber-500/10">
                      <p className="text-2xl font-bold text-amber-600">{jobStats.running_jobs}</p>
                      <p className="text-sm text-muted-foreground">진행 중</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gray-500/10">
                      <p className="text-2xl font-bold text-gray-600">{jobStats.cancelled_jobs}</p>
                      <p className="text-sm text-muted-foreground">취소됨</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-destructive/10">
                      <p className="text-2xl font-bold text-destructive">{jobStats.failed_jobs}</p>
                      <p className="text-sm text-muted-foreground">실패</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-primary/10">
                      <p className="text-2xl font-bold text-primary">{jobStats.success_rate}%</p>
                      <p className="text-sm text-muted-foreground">성공률</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
