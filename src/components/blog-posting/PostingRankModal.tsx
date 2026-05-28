'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TrendingUp, Loader2 } from 'lucide-react';
import { usePostingRankHistory } from '@/hooks/usePostings';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7',
];

const DATE_RANGES = [
  { value: '7', label: '최근 7일' },
  { value: '14', label: '최근 14일' },
  { value: '30', label: '최근 30일' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  title?: string;
}

export function PostingRankModal({ open, onOpenChange, url, title }: Props) {
  const [days, setDays] = useState('14');
  const { data: rows = [], isLoading } = usePostingRankHistory(open ? url : null, parseInt(days));

  // 데이터 가공: 날짜 × 키워드 매트릭스. 같은 날 여러 수집이 있으면 최상위(최소) 순위 채택.
  const { chartData, keywords } = useMemo(() => {
    const byDateKw = new Map<string, Map<string, number>>(); // date → kw → bestRank
    const kwSet = new Set<string>();
    for (const r of rows) {
      if (!r.keyword) continue;
      kwSet.add(r.keyword);
      const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
      if (!byDateKw.has(date)) byDateKw.set(date, new Map());
      const m = byDateKw.get(date)!;
      const prev = m.get(r.keyword);
      if (prev === undefined || r.rank < prev) m.set(r.keyword, r.rank);
    }
    const dates = Array.from(byDateKw.keys()).sort();
    const kws = Array.from(kwSet);
    const chart = dates.map((d) => {
      const row: Record<string, string | number> = { date: format(parseISO(d), 'MM/dd', { locale: ko }) };
      const m = byDateKw.get(d)!;
      for (const kw of kws) {
        const v = m.get(kw);
        if (v !== undefined) row[kw] = v;
      }
      return row;
    });
    return { chartData: chart, keywords: kws };
  }, [rows]);

  // 순위 진입·이탈 요약: 각 키워드의 최초/최종 등장 날짜
  const summary = useMemo(() => {
    const map = new Map<string, { first: string; last: string; bestRank: number; count: number }>();
    for (const r of rows) {
      if (!r.keyword) continue;
      const cur = map.get(r.keyword);
      const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
      if (!cur) {
        map.set(r.keyword, { first: date, last: date, bestRank: r.rank, count: 1 });
      } else {
        if (date < cur.first) cur.first = date;
        if (date > cur.last) cur.last = date;
        if (r.rank < cur.bestRank) cur.bestRank = r.rank;
        cur.count += 1;
      }
    }
    return Array.from(map.entries()).map(([kw, v]) => ({ keyword: kw, ...v }));
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            포스팅 순위 추이
          </DialogTitle>
          <DialogDescription className="break-all">
            {title ? <span className="font-medium">{title}</span> : null}
            {title && url ? ' · ' : null}
            <span className="text-xs">{url}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 기간 필터 */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              키워드 <span className="font-semibold text-foreground">{keywords.length}</span>건 ·
              데이터 포인트 <span className="font-semibold text-foreground">{rows.length}</span>건
            </p>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover">
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 차트 */}
          {isLoading ? (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> 불러오는 중...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[360px] flex items-center justify-center text-center text-muted-foreground">
              <div>
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">선택한 기간에 순위 진입 데이터가 없습니다</p>
                <p className="text-sm mt-1">기간을 늘려보거나 키워드 수집을 실행하세요.</p>
              </div>
            </div>
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    reversed
                    domain={[1, 10]}
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    label={{ value: '순위(낮을수록 상위)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value}위`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {keywords.map((kw, idx) => (
                    <Line
                      key={kw}
                      type="monotone"
                      dataKey={kw}
                      name={kw}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 키워드별 진입·이탈 요약 */}
          {summary.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground">키워드별 진입·이탈 요약</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {summary
                  .sort((a, b) => a.bestRank - b.bestRank)
                  .map((s, i) => (
                    <div key={s.keyword} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: COLORS[keywords.indexOf(s.keyword) % COLORS.length] }} />
                        <span className="truncate font-medium">{s.keyword}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground flex-shrink-0">
                        <Badge variant="outline" className="font-normal">최고 {s.bestRank}위</Badge>
                        <span>{s.first} ~ {s.last}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
