 import { useState, useMemo } from 'react';
 import { motion } from 'framer-motion';
 import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
 import { useCrawlResults, useSearchEngines } from '@/hooks/useCrawlResults';
 import { useKeywords } from '@/hooks/useKeywords';
 import { format, subDays, parseISO } from 'date-fns';
 import { ko } from 'date-fns/locale';
 
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
   const [selectedEngine, setSelectedEngine] = useState<string>('all');
   const [dateRange, setDateRange] = useState('7');
 
   const dateFrom = useMemo(() => {
     return subDays(new Date(), parseInt(dateRange)).toISOString();
   }, [dateRange]);
 
   const { data: results, isLoading } = useCrawlResults({
     search_engine_id: selectedEngine === 'all' ? undefined : selectedEngine,
     date_from: dateFrom,
   });
   const { data: keywords } = useKeywords();
   const { data: engines } = useSearchEngines();
 
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
 
   const getKeywordName = (id: string) => {
     return keywords?.find((k) => k.id === id)?.keyword || id;
   };
 
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
 
   return (
     <div className="space-y-6">
       {/* Filters */}
       <Card className="shadow-card">
         <CardContent className="pt-6">
           <div className="flex flex-wrap gap-4">
             <Select value={selectedEngine} onValueChange={setSelectedEngine}>
               <SelectTrigger className="w-40">
                 <SelectValue placeholder="검색 엔진" />
               </SelectTrigger>
               <SelectContent className="bg-popover">
                 <SelectItem value="all">전체 엔진</SelectItem>
                 {engines?.map((engine) => (
                   <SelectItem key={engine.id} value={engine.id}>
                     {engine.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
 
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
           <div className="mt-4">
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
                     className="cursor-pointer transition-colors"
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
 
       {/* Chart */}
       <Card className="shadow-card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <TrendingUp className="w-5 h-5" />
             순위 변동 차트
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="h-[400px]">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={chartData}>
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
                   contentStyle={{
                     backgroundColor: 'hsl(var(--card))',
                     border: '1px solid hsl(var(--border))',
                     borderRadius: '8px',
                   }}
                   formatter={(value: number, name: string) => [
                     `${value}위`,
                     getKeywordName(name),
                   ]}
                   labelFormatter={(label) => `날짜: ${label}`}
                 />
                 <Legend
                   formatter={(value) => getKeywordName(value)}
                   wrapperStyle={{ paddingTop: '20px' }}
                 />
                 {(selectedKeywords.length === 0
                   ? displayKeywordIds.slice(0, 5)
                   : selectedKeywords
                 ).map((kwId, index) => (
                   <Line
                     key={kwId}
                     type="monotone"
                     dataKey={kwId}
                     name={kwId}
                     stroke={COLORS[index % COLORS.length]}
                     strokeWidth={2}
                     dot={{ r: 4 }}
                     activeDot={{ r: 6 }}
                     connectNulls
                   />
                 ))}
               </LineChart>
             </ResponsiveContainer>
           </div>
         </CardContent>
       </Card>
 
       {/* Stats Cards */}
       {Object.keys(keywordStats).length > 0 && (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
           {(selectedKeywords.length === 0
             ? displayKeywordIds.slice(0, 5)
             : selectedKeywords
           ).map((kwId, index) => {
             const stats = keywordStats[kwId];
             if (!stats) return null;
 
             const isImproved = stats.change > 0;
             const isUnchanged = stats.change === 0;
 
             return (
               <motion.div
                 key={kwId}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: index * 0.1 }}
               >
                 <Card className="shadow-card">
                   <CardContent className="pt-4">
                     <div className="flex items-center justify-between mb-2">
                       <span
                         className="w-3 h-3 rounded-full"
                         style={{ backgroundColor: COLORS[index % COLORS.length] }}
                       />
                       <span className="text-sm font-medium truncate flex-1 ml-2">
                         {getKeywordName(kwId)}
                       </span>
                     </div>
                     <div className="flex items-center justify-between">
                       <div className="text-2xl font-bold">{stats.last}위</div>
                       <div
                         className={`flex items-center gap-1 text-sm ${
                           isImproved
                             ? 'text-success'
                             : isUnchanged
                             ? 'text-muted-foreground'
                             : 'text-destructive'
                         }`}
                       >
                         {isImproved ? (
                           <TrendingUp className="w-4 h-4" />
                         ) : isUnchanged ? (
                           <Minus className="w-4 h-4" />
                         ) : (
                           <TrendingDown className="w-4 h-4" />
                         )}
                         <span>
                           {isUnchanged
                             ? '변동 없음'
                             : `${Math.abs(stats.change)}${isImproved ? '↑' : '↓'}`}
                         </span>
                       </div>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1">
                       {stats.first}위 → {stats.last}위
                     </p>
                   </CardContent>
                 </Card>
               </motion.div>
             );
           })}
         </div>
       )}
     </div>
   );
 }