import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCrawlResults } from '@/hooks/useCrawlResults';
import { useKeywords } from '@/hooks/useKeywords';
import { useBloggers } from '@/hooks/useBloggers';
import { OFFICIAL_BLOG_ID, extractBlogId } from '@/hooks/useBlogUrls';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

const DATE_RANGES = [
  { value: '7', label: '최근 7일' },
  { value: '14', label: '최근 14일' },
  { value: '30', label: '최근 30일' },
];

// 우리 블로그가 AI 브리핑에 노출된 (키워드 × 날짜) 점. y축 = 키워드.
export function AiBriefingTrend() {
  const [dateRange, setDateRange] = useState('14');

  const cutoffIso = useMemo(() => {
    const now = new Date();
    const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
    const start = Math.floor(kstMs / 86400000) * 86400000 - (parseInt(dateRange) - 1) * 86400000;
    return new Date(start - 9 * 60 * 60 * 1000).toISOString();
  }, [dateRange]);

  const { data: briefing } = useCrawlResults({ latestOnly: false, crawled_after: cutoffIso, aiBriefing: 'only' });
  const { data: keywords } = useKeywords();
  const { data: bloggers = [] } = useBloggers();

  const ourBlogIds = useMemo(() => {
    const s = new Set<string>([OFFICIAL_BLOG_ID]);
    bloggers.forEach((b) => { if (b.blog_id && b.status === '계약됨') s.add(b.blog_id); });
    return s;
  }, [bloggers]);

  const getKeywordName = (id: string) => keywords?.find((k) => k.id === id)?.keyword || id;

  // 우리 블로그가 브리핑에 노출된 (kwId, date) 유니크 점
  const { points, kwOrder } = useMemo(() => {
    const set = new Set<string>();
    const kwIds: string[] = [];
    (briefing ?? []).forEach((r) => {
      const bid = extractBlogId(r.blog_url);
      if (!bid || !ourBlogIds.has(bid)) return;
      const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
      const key = `${r.keyword_id}|${date}`;
      if (set.has(key)) return;
      set.add(key);
      if (!kwIds.includes(r.keyword_id)) kwIds.push(r.keyword_id);
    });
    const order = kwIds;
    const pts = [...set].map((k) => {
      const [kwId, date] = k.split('|');
      return { x: parseISO(date).getTime(), y: order.indexOf(kwId), kwId, date };
    });
    return { points: pts, kwOrder: order };
  }, [briefing, ourBlogIds]);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI 브리핑 노출 추이 (우리 블로그)
          </CardTitle>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              {DATE_RANGES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>기간 내 우리 블로그의 AI 브리핑 노출이 없습니다.</p>
          </div>
        ) : (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                  tickFormatter={(v) => format(new Date(v), 'MM/dd', { locale: ko })}
                  tick={{ fontSize: 12 }} scale="time"
                />
                <YAxis
                  type="number" dataKey="y" domain={[-0.5, Math.max(0, kwOrder.length - 1) + 0.5]}
                  ticks={kwOrder.map((_, i) => i)}
                  tickFormatter={(v) => getKeywordName(kwOrder[v])}
                  tick={{ fontSize: 12 }} width={80} interval={0}
                />
                <ZAxis range={[120, 120]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(_v, _n, p: any) => [format(new Date(p.payload.x), 'yyyy-MM-dd'), getKeywordName(p.payload.kwId)]}
                />
                <Scatter data={points} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
