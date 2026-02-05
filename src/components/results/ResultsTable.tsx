import { useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Calendar, User, FileText, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrawlResults, useSearchEngines } from '@/hooks/useCrawlResults';
import { useKeywords } from '@/hooks/useKeywords';
import { convertToCSV, downloadCSV } from '@/lib/utils/csv-export';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

function getRankBadgeClass(rank: number) {
  if (rank === 1) return 'rank-badge rank-1';
  if (rank === 2) return 'rank-badge rank-2';
  if (rank === 3) return 'rank-badge rank-3';
  return 'rank-badge rank-default';
}

function getEngineBadge(name: string) {
  if (name === '네이버') {
    return <Badge className="bg-naver text-white border-0 text-xs">네이버</Badge>;
  }
  return <Badge className="bg-google-blue text-white border-0 text-xs">구글</Badge>;
}

interface ResultsTableProps {
  onExportReady?: (exportFn: () => void) => void;
}

export function ResultsTable({ onExportReady }: ResultsTableProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    keyword_id: '',
    search_engine_id: '',
    date_from: '',
    date_to: '',
  });

  const { data: results, isLoading } = useCrawlResults({
    keyword_id: filters.keyword_id || undefined,
    search_engine_id: filters.search_engine_id || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  });
  const { data: keywords } = useKeywords();
  const { data: engines } = useSearchEngines();

  const handleExportCSV = () => {
    if (!results || results.length === 0) {
      toast({
        title: '내보낼 데이터 없음',
        description: '내보낼 수집 결과가 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    const csvColumns = [
      { key: 'rank' as const, header: '순위' },
      { key: 'keyword_name' as const, header: '키워드' },
      { key: 'engine_name' as const, header: '검색엔진' },
      { key: 'blog_title' as const, header: '블로그 제목' },
      { key: 'blog_author' as const, header: '작성자' },
      { key: 'blog_platform' as const, header: '플랫폼' },
      { key: 'blog_url' as const, header: 'URL' },
      { key: 'snippet' as const, header: '요약' },
      { key: 'crawled_at' as const, header: '수집일시' },
    ];

    const exportData = results.map((r) => ({
      rank: r.rank,
      keyword_name: r.keyword?.keyword || '',
      engine_name: r.search_engine?.name || '',
      blog_title: r.blog_title,
      blog_author: r.blog_author || '',
      blog_platform: r.blog_platform || '',
      blog_url: r.blog_url,
      snippet: r.snippet || '',
      crawled_at: format(new Date(r.crawled_at), 'yyyy-MM-dd HH:mm:ss'),
    }));

    const csv = convertToCSV(exportData, csvColumns);
    const filename = `블로그순위_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    
    downloadCSV(csv, filename);

    toast({
      title: 'CSV 내보내기 완료',
      description: `${results.length}개의 결과를 내보냈습니다.`,
    });
  };

  // Expose export function to parent
  if (onExportReady) {
    onExportReady(handleExportCSV);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg animate-shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-card rounded-xl border shadow-card">
        <Select
          value={filters.keyword_id || 'all'}
          onValueChange={(v) => setFilters((f) => ({ ...f, keyword_id: v === 'all' ? '' : v }))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="키워드 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 키워드</SelectItem>
            {keywords?.map((kw) => (
              <SelectItem key={kw.id} value={kw.id}>
                {kw.keyword}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.search_engine_id || 'all'}
          onValueChange={(v) => setFilters((f) => ({ ...f, search_engine_id: v === 'all' ? '' : v }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="검색 엔진" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 엔진</SelectItem>
            {engines?.map((engine) => (
              <SelectItem key={engine.id} value={engine.id}>
                {engine.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
            className="w-40"
          />
          <span className="text-muted-foreground">~</span>
          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
            className="w-40"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setFilters({ keyword_id: '', search_engine_id: '', date_from: '', date_to: '' })}
        >
          초기화
        </Button>

        <Button
          variant="outline"
          onClick={handleExportCSV}
          className="ml-auto gap-2"
        >
          <Download className="w-4 h-4" />
          CSV 내보내기
        </Button>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        총 <span className="font-semibold text-foreground">{results?.length || 0}</span>개의 결과
      </p>

      {/* Table */}
      {results && results.length > 0 ? (
        <div className="rounded-xl border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">순위</TableHead>
                <TableHead className="w-28">검색엔진</TableHead>
                <TableHead className="w-32">키워드</TableHead>
                <TableHead>블로그</TableHead>
                <TableHead className="w-36">수집일시</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, index) => (
                <motion.tr
                  key={result.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.01 }}
                  className="group"
                >
                  <TableCell>
                    <span className={getRankBadgeClass(result.rank)}>{result.rank}</span>
                  </TableCell>
                  <TableCell>
                    {result.search_engine && getEngineBadge(result.search_engine.name)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{result.keyword?.keyword}</span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-sm line-clamp-1">{result.blog_title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {result.blog_author && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {result.blog_author}
                          </span>
                        )}
                        {result.blog_platform && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {result.blog_platform}
                          </span>
                        )}
                      </div>
                      {result.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(result.crawled_at), 'MM/dd HH:mm', { locale: ko })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <a
                      href={result.blog_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 inline-flex"
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border shadow-card">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>수집된 결과가 없습니다.</p>
        </div>
      )}
    </div>
  );
}