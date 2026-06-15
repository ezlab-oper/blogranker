import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, User, FileText, Download, ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrawlResults, useSearchEngines } from '@/hooks/useCrawlResults';
import { useKeywords } from '@/hooks/useKeywords';
import { buildMatchers, getMatchType, type MatchType } from '@/hooks/useBlogUrls';
import { useBloggers } from '@/hooks/useBloggers';
import { usePostings } from '@/hooks/usePostings';
import { useKeywordSearchVolume } from '@/hooks/useKeywordSearchVolume';
import { convertToCSV, downloadCSV } from '@/lib/utils/csv-export';
import { useToast } from '@/hooks/use-toast';
import { usePrograms } from '@/hooks/usePrograms';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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
  selectedProgram: string;
  onSelectedProgramChange: (v: string) => void;
  selectedKeywordId: string;
  onSelectedKeywordIdChange: (v: string) => void;
  selectedEngine: string;
  onSelectedEngineChange: (v: string) => void;
  // KST YYYY-MM-DD
  selectedDate: string;
  onSelectedDateChange: (v: string) => void;
}

// KST 자정 기준 오늘 YYYY-MM-DD
function todayKstString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' KST → Date (그날 자정 KST를 표현하는 Date 객체, Calendar 표시용)
function dateFromKstString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function kstStringFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ResultsTable({
  onExportReady,
  selectedProgram,
  onSelectedProgramChange,
  selectedKeywordId,
  onSelectedKeywordIdChange,
  selectedEngine,
  onSelectedEngineChange,
  selectedDate,
  onSelectedDateChange,
}: ResultsTableProps) {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const { data: results, isLoading } = useCrawlResults({
    keyword_id: selectedKeywordId || undefined,
    crawl_date: selectedDate || undefined,
  });
  const { data: allKeywords } = useKeywords();
  // buildMatchers가 status 기준으로 계약됨/계약만료를 내부에서 분리한다.
  const { data: bloggers = [] } = useBloggers();
  const { data: postings = [] } = usePostings();
  const { data: searchEngines } = useSearchEngines();
  const { data: programs = [] } = usePrograms();
  // 키워드 전체를 넘겨서 Keywords 페이지와 같은 캐시 공유 (검색량 PC/모바일 컬럼 채움).
  const keywordStrings = useMemo(() => (allKeywords ?? []).map((k) => k.keyword), [allKeywords]);
  const { getVolume } = useKeywordSearchVolume(keywordStrings);

  // 매칭 빌더: postings(협업 포스팅) + bloggers(협업 블로거) 단일 소스
  const matchers = useMemo(() => buildMatchers(postings, bloggers), [postings, bloggers]);

  // Filter keywords by selected program
  const filteredKeywords = useMemo(() => {
    if (!allKeywords) return [];
    if (!selectedProgram) return allKeywords;
    return allKeywords.filter(kw => kw.program === selectedProgram);
  }, [allKeywords, selectedProgram]);

  // 엔진 필터 → 정렬(네이버 우선, rank 오름차순)
  const sortedResults = useMemo(() => {
    if (!results) return undefined;
    const filtered = selectedEngine
      ? results.filter((r) => r.search_engine?.name === selectedEngine)
      : results;
    return [...filtered].sort((a, b) => {
      const aIsNaver = a.search_engine?.name === '네이버' ? 0 : 1;
      const bIsNaver = b.search_engine?.name === '네이버' ? 0 : 1;
      if (aIsNaver !== bIsNaver) return aIsNaver - bIsNaver;
      return a.rank - b.rank;
    });
  }, [results, selectedEngine]);

  // Pagination logic
  const totalItems = sortedResults?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedResults = sortedResults?.slice(startIndex, endIndex);

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(Number(newSize));
    setCurrentPage(1);
  };

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
        {/* Program filter */}
        <Select
          value={selectedProgram || 'all'}
          onValueChange={(v) => {
            onSelectedProgramChange(v === 'all' ? '' : v);
            onSelectedKeywordIdChange('');
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="프로그램" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">전체 프로그램</SelectItem>
            {programs.map((prog) => (
              <SelectItem key={prog.id} value={prog.name}>{prog.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Keyword filter (filtered by program) */}
        <Select
          value={selectedKeywordId || 'all'}
          onValueChange={(v) => onSelectedKeywordIdChange(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="키워드 선택" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">전체 키워드</SelectItem>
            {filteredKeywords.map((kw) => (
              <SelectItem key={kw.id} value={kw.id}>
                {kw.keyword}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search engine filter */}
        <Select
          value={selectedEngine || 'all'}
          onValueChange={(v) => {
            onSelectedEngineChange(v === 'all' ? '' : v);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="검색엔진" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">전체 엔진</SelectItem>
            {(searchEngines || []).map((eng) => (
              <SelectItem key={eng.id} value={eng.name}>
                {eng.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date filter (single day, KST) */}
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-44 justify-start gap-2 font-normal">
              <CalendarIcon className="w-4 h-4" />
              {selectedDate || '날짜 선택'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover" align="start">
            <Calendar
              mode="single"
              selected={selectedDate ? dateFromKstString(selectedDate) : undefined}
              onSelect={(d) => {
                if (d) {
                  onSelectedDateChange(kstStringFromDate(d));
                  setCurrentPage(1);
                  setDatePopoverOpen(false);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          onClick={() => {
            onSelectedProgramChange('');
            onSelectedKeywordIdChange('');
            onSelectedEngineChange('');
            onSelectedDateChange(todayKstString());
            setCurrentPage(1);
          }}
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

      {/* Highlight Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">범례:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-violet-500/20 border border-violet-500/30" />
          공식블로그 (blog.naver.com/ezlab_official)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
          협업 포스팅 (URL 일치)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-sky-500/20 border border-sky-500/30" />
          협업 블로거 (계약됨)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30" />
          계약만료 블로거
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-muted border" />
          일반
        </span>
      </div>

      {/* Results count and page size selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          총 <span className="font-semibold text-foreground">{totalItems}</span>개의 결과
          {totalItems > 0 && (
            <span className="ml-2">
              ({startIndex + 1} - {Math.min(endIndex, totalItems)} 표시 중)
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">페이지당</span>
          <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}개
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {paginatedResults && paginatedResults.length > 0 ? (
        <div className="rounded-xl border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">순위</TableHead>
                <TableHead className="w-28">검색엔진</TableHead>
                <TableHead className="w-32">키워드</TableHead>
                <TableHead className="w-20 text-right">PC 검색수</TableHead>
                <TableHead className="w-24 text-right">모바일 검색수</TableHead>
                <TableHead>블로그</TableHead>
                <TableHead className="w-36">수집일시</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedResults.map((result, index) => {
                const matchType: MatchType = getMatchType(result.blog_url, matchers);

                const rowBg = matchType === 'official_blog'
                  ? 'bg-violet-500/10 hover:bg-violet-500/15'
                  : matchType === 'exact_url'
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                  : matchType === 'expired_blogger'
                  ? 'bg-red-500/10 hover:bg-red-500/15'
                  : '';

                const volume = result.keyword?.keyword ? getVolume(result.keyword.keyword) : undefined;
                const formatVol = (v: number | string | undefined) => {
                  if (v === undefined || v === '< 10') return v ?? '-';
                  return Number(v).toLocaleString();
                };

                return (
                  <motion.tr
                    key={result.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.01 }}
                    className={cn("group", rowBg)}
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
                    <TableCell className="text-right text-sm tabular-nums">
                      {volume ? formatVol(volume.monthlyPcQcCnt) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {volume ? formatVol(volume.monthlyMobileQcCnt) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className={cn(
                          "font-medium text-sm line-clamp-1",
                          matchType === 'official_blog' && "text-violet-700 dark:text-violet-400",
                          matchType === 'exact_url' && "text-emerald-700 dark:text-emerald-400"
                        )}>
                          {result.blog_title}
                          {matchType === 'official_blog' && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-700 dark:text-violet-300">
                              공식블로그
                            </span>
                          )}
                          {matchType === 'exact_url' && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                              협업 포스팅
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {result.blog_author && (
                            <span className={cn(
                              "flex items-center gap-1",
                              matchType === 'same_blog_id' && "px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 font-medium",
                              matchType === 'expired_blogger' && "px-1.5 py-0.5 rounded bg-red-500/20 text-red-700 dark:text-red-300 font-medium",
                            )}>
                              <User className="w-3 h-3" />
                              {result.blog_author}
                              {matchType === 'same_blog_id' && (
                                <span className="text-[10px] ml-1">협업 블로거</span>
                              )}
                              {matchType === 'expired_blogger' && (
                                <span className="text-[10px] ml-1">계약만료</span>
                              )}
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
                      <div className="text-sm text-muted-foreground leading-tight">
                        <div>{format(new Date(result.crawled_at), 'yyyy-MM-dd')}</div>
                        <div className="text-xs">{format(new Date(result.crawled_at), 'HH:mm:ss')}</div>
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border shadow-card">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-1">
            {selectedDate ? `${selectedDate} 수집된 결과가 없습니다` : '수집된 결과가 없습니다'}
          </p>
          <p className="text-sm">다른 날짜를 선택하거나 '수집 시작' 버튼으로 새 수집을 실행하세요</p>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            처음
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {generatePageNumbers(currentPage, totalPages).map((page, idx) =>
              page === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage(page as number)}
                >
                  {page}
                </Button>
              )
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            마지막
          </Button>
        </div>
      )}
    </div>
  );
}

// Generate page numbers with ellipsis for large page counts
function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }

  return pages;
}