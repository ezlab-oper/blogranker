import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  HardDrive,
  Zap,
  Activity,
  RefreshCw,
  TrendingUp,
  Server,
  Loader2,
  PieChart,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useUsageLogs, useCollectUsage, useCumulativeStats, useTodayUsage } from '@/hooks/useUsageLogs';
import { useApiTracking } from '@/hooks/useApiTracking';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const DATE_RANGES = [
  { value: '7', label: '최근 7일' },
  { value: '14', label: '최근 14일' },
  { value: '30', label: '최근 30일' },
];

const FEATURE_LABELS: Record<string, string> = {
  dashboard: '대시보드',
  keywords: '키워드 관리',
  results: '수집 결과',
  trends: '순위 추이',
  statistics: '통계',
  settings: '설정',
  usage: '사용량',
  scraping: '스크래핑',
  other: '기타',
};

const FEATURE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
];

export default function Usage() {
  useApiTracking('usage');
  
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState('30');

  const { data: logs, isLoading: logsLoading } = useUsageLogs(parseInt(dateRange));
  const { data: cumulative, isLoading: cumulativeLoading } = useCumulativeStats();
  const { data: todayUsage, isLoading: todayLoading } = useTodayUsage();
  const collectUsage = useCollectUsage();

  // Auto-collect on page load if no today data
  useEffect(() => {
    if (!todayLoading && !todayUsage && !collectUsage.isPending) {
      collectUsage.mutate();
    }
  }, [todayLoading, todayUsage]);

  const handleRefresh = async () => {
    try {
      const result = await collectUsage.mutateAsync();
      toast({
        title: '사용량 수집 완료',
        description: `데이터베이스 행: ${result.today.database_rows?.toLocaleString() || 0}개`,
      });
    } catch (error) {
      console.error('Error collecting usage:', error);
      toast({
        title: '사용량 수집 실패',
        description: '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    }
  };

  const chartData = logs?.map((log) => ({
    date: format(parseISO(log.date), 'MM/dd', { locale: ko }),
    rows: log.database_rows,
    dbSize: log.database_size_mb,
    storageSize: log.storage_size_mb,
    edgeCalls: log.edge_function_invocations,
    apiRequests: log.api_requests,
  })) || [];

  // Feature breakdown data for pie chart
  const featureBreakdownData = cumulative?.featureBreakdown
    ? Object.entries(cumulative.featureBreakdown)
        .map(([feature, count], index) => ({
          name: FEATURE_LABELS[feature] || feature,
          value: count,
          color: FEATURE_COLORS[index % FEATURE_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const totalFeatureRequests = featureBreakdownData.reduce((sum, item) => sum + item.value, 0);

  // Today's feature breakdown
  const todayFeatureData = todayUsage?.api_requests_by_feature
    ? Object.entries(todayUsage.api_requests_by_feature)
        .map(([feature, count], index) => ({
          name: FEATURE_LABELS[feature] || feature,
          value: count as number,
          color: FEATURE_COLORS[index % FEATURE_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const isLoading = logsLoading || cumulativeLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">사용량 모니터링</h1>
            <p className="text-muted-foreground mt-1">
              리소스 사용량을 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
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
            <Button
              onClick={handleRefresh}
              disabled={collectUsage.isPending}
              className="gap-2"
            >
              {collectUsage.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              새로고침
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">데이터베이스</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cumulative?.currentDatabaseRows?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    행 ({cumulative?.currentDatabaseSizeMb?.toFixed(2) || 0} MB)
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">스토리지</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cumulative?.currentStorageSizeMb?.toFixed(2) || 0} MB
                  </div>
                  <p className="text-xs text-muted-foreground">현재 사용량</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Edge Functions</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cumulative?.totalEdgeInvocations?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    누적 호출 수 (오늘: {todayUsage?.edge_function_invocations || 0})
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API 요청</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cumulative?.totalApiRequests?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    누적 요청 수 (오늘: {todayUsage?.api_requests || 0})
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Feature Breakdown */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Feature Breakdown */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                오늘 기능별 API 요청
              </CardTitle>
              <CardDescription>오늘 각 기능에서 발생한 API 요청 비중</CardDescription>
            </CardHeader>
            <CardContent>
              {todayFeatureData.length > 0 ? (
                <div className="flex flex-col lg:flex-row items-center gap-4">
                  <div className="h-[250px] w-full lg:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={todayFeatureData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {todayFeatureData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`${value}회`, '요청']}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full lg:w-1/2 space-y-2">
                    {todayFeatureData.map((item, index) => {
                      const percentage = todayUsage?.api_requests 
                        ? Math.round((item.value / todayUsage.api_requests) * 100) 
                        : 0;
                      return (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span>{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.value}</span>
                            <span className="text-muted-foreground">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>오늘 API 요청 데이터가 없습니다</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cumulative Feature Breakdown */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                누적 기능별 API 요청
              </CardTitle>
              <CardDescription>전체 기간 동안 각 기능에서 발생한 API 요청 비중</CardDescription>
            </CardHeader>
            <CardContent>
              {featureBreakdownData.length > 0 ? (
                <div className="flex flex-col lg:flex-row items-center gap-4">
                  <div className="h-[250px] w-full lg:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={featureBreakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {featureBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`${value.toLocaleString()}회`, '요청']}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full lg:w-1/2 space-y-2">
                    {featureBreakdownData.map((item, index) => {
                      const percentage = totalFeatureRequests 
                        ? Math.round((item.value / totalFeatureRequests) * 100) 
                        : 0;
                      return (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span>{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.value.toLocaleString()}</span>
                            <span className="text-muted-foreground">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <PieChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>기능별 데이터가 없습니다</p>
                    <p className="text-sm mt-1">앱을 사용하면 자동으로 수집됩니다</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Database Rows Chart */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                데이터베이스 행 수 추이
              </CardTitle>
              <CardDescription>일별 데이터베이스 행 수 변화</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [value.toLocaleString(), '행 수']}
                      />
                      <Line
                        type="monotone"
                        dataKey="rows"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>데이터가 없습니다</p>
                    <p className="text-sm">새로고침 버튼을 클릭하여 수집을 시작하세요</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Requests Chart */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                API 요청 추이
              </CardTitle>
              <CardDescription>일별 API 요청 및 Edge Function 호출 수</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="apiRequests"
                        name="API 요청"
                        fill="hsl(var(--chart-1))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="edgeCalls"
                        name="Edge 호출"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>데이터가 없습니다</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Usage History Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              일별 사용량 기록
            </CardTitle>
            <CardDescription>날짜별 리소스 사용량 상세 기록</CardDescription>
          </CardHeader>
          <CardContent>
            {logs && logs.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>날짜</TableHead>
                      <TableHead className="text-right">DB 행 수</TableHead>
                      <TableHead className="text-right">DB 크기</TableHead>
                      <TableHead className="text-right">스토리지</TableHead>
                      <TableHead className="text-right">Edge 호출</TableHead>
                      <TableHead className="text-right">API 요청</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...logs].reverse().map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(log.date), 'yyyy-MM-dd (EEE)', { locale: ko })}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.database_rows?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.database_size_mb?.toFixed(2) || 0} MB
                        </TableCell>
                        <TableCell className="text-right">
                          {log.storage_size_mb?.toFixed(2) || 0} MB
                        </TableCell>
                        <TableCell className="text-right">
                          {log.edge_function_invocations?.toLocaleString() || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.api_requests?.toLocaleString() || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>사용량 기록이 없습니다</p>
                <p className="text-sm mt-1">새로고침 버튼을 클릭하여 현재 사용량을 수집하세요</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}