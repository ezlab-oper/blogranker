import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStatistics } from '@/hooks/useStatistics';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  TrendingUp,
  Target,
  FileText,
  CheckCircle2,
  PieChart,
  Activity,
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

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
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
  const {
    overview,
    engineStats,
    platformStats,
    dailyStats,
    rankDistribution,
    jobStats,
    isLoading,
  } = useStatistics();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">수집 통계</h1>
            <p className="text-muted-foreground mt-1">
              스크래핑 결과에 대한 상세 통계를 확인합니다
            </p>
          </div>
          <LoadingSkeleton />
        </div>
      </AppLayout>
    );
  }

  const enginePieData = engineStats.map(e => ({
    name: e.engine_name,
    value: e.total_results,
  }));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">수집 통계</h1>
            <p className="text-muted-foreground mt-1">
              스크래핑 결과에 대한 상세 통계를 확인합니다
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Activity className="w-3 h-3" />
            실시간 집계
          </Badge>
        </div>

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
              <CardDescription>최근 14일간 엔진별 수집 현황</CardDescription>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{jobStats.total_jobs}</p>
                  <p className="text-sm text-muted-foreground">전체 작업</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-500/10">
                  <p className="text-2xl font-bold text-green-600">{jobStats.successful_jobs}</p>
                  <p className="text-sm text-muted-foreground">성공</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-500/10">
                  <p className="text-2xl font-bold text-red-600">{jobStats.failed_jobs}</p>
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
      </div>
    </AppLayout>
  );
}
