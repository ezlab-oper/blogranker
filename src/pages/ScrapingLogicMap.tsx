import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Code2, 
  MousePointerClick, 
  Wifi, 
  Shield, 
  CheckCircle2,
  Globe,
  ExternalLink,
  Clock,
  FileCode,
  Zap
} from 'lucide-react';

interface LogicSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: {
    description: string;
    items: {
      label: string;
      value: string;
      badge?: string;
      badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
    }[];
    codeExample?: string;
  };
}

const naverLogic: LogicSection[] = [
  {
    id: 'dom',
    title: 'DOM 접근 방식',
    icon: <Code2 className="w-5 h-5" />,
    content: {
      description: 'Firecrawl API를 통해 렌더링된 HTML을 마크다운으로 변환하여 파싱합니다.',
      items: [
        { label: '수집 URL', value: 'search.naver.com/search.naver?query={keyword}', badge: '통합검색' },
        { label: '파싱 대상', value: 'Markdown 링크 패턴 [title](url)' },
        { label: '링크 배열', value: 'Firecrawl links 배열 (출현 순서 보장)' },
        { label: '유효 URL 패턴', value: 'blog.naver.com/{id}/{postId}, m.blog.naver.com/{id}/{postId}' },
        { label: '추가 패턴', value: 'PostView.nhn?blogId=..., PostView.naver?blogId=...' },
      ],
      codeExample: `/blog\\.naver\\.com\\/[a-zA-Z0-9_-]+\\/\\d+/
/m\\.blog\\.naver\\.com\\/[a-zA-Z0-9_-]+\\/\\d+/
/PostView\\.(nhn|naver)\\?.*blogId=/`,
    },
  },
  {
    id: 'events',
    title: '이벤트 트리거',
    icon: <MousePointerClick className="w-5 h-5" />,
    content: {
      description: '정적 페이지 스크래핑으로 별도의 이벤트 트리거 없이 초기 로드된 콘텐츠만 수집합니다.',
      items: [
        { label: '페이지 로드 대기', value: '5000ms (waitFor)', badge: '설정됨', badgeVariant: 'secondary' },
        { label: '스크롤 이벤트', value: '없음 - 초기 로드만 수집', badge: '의도적 제한' },
        { label: '클릭 이벤트', value: '없음 - 더보기 버튼 미클릭', badge: '의도적 제한' },
        { label: 'Ajax 대기', value: 'Firecrawl 내부 처리' },
      ],
    },
  },
  {
    id: 'network',
    title: '네트워크 수집 여부',
    icon: <Wifi className="w-5 h-5" />,
    content: {
      description: 'Firecrawl API를 통한 단일 HTTP 요청으로 수집합니다.',
      items: [
        { label: 'API 엔드포인트', value: 'api.firecrawl.dev/v1/scrape', badge: 'POST' },
        { label: '응답 포맷', value: 'markdown, links 배열' },
        { label: 'XHR/Fetch 인터셉트', value: '없음 - 서버 사이드 렌더링 결과만', badge: 'N/A', badgeVariant: 'outline' },
        { label: '리다이렉트 처리', value: 'Firecrawl 내부 처리' },
      ],
    },
  },
  {
    id: 'antibot',
    title: '안티봇 대응 요소',
    icon: <Shield className="w-5 h-5" />,
    content: {
      description: 'Firecrawl의 내장 봇 감지 우회 및 추가 안정화 전략을 적용합니다.',
      items: [
        { label: '랜덤 지연', value: '3~7초 사이 랜덤 딜레이', badge: '적용됨' },
        { label: '엔진 순서 셔플', value: '검색 엔진 요청 순서 무작위화', badge: '적용됨' },
        { label: 'User-Agent', value: 'Firecrawl 기본 로테이션 사용', badge: '자동' },
        { label: 'Headless 브라우저', value: 'Firecrawl 내장 (Playwright 기반)', badge: '자동' },
        { label: 'CAPTCHA 대응', value: '현재 미지원', badge: '제한', badgeVariant: 'destructive' },
      ],
    },
  },
  {
    id: 'stability',
    title: '안정성 체크 포인트',
    icon: <CheckCircle2 className="w-5 h-5" />,
    content: {
      description: '데이터 품질과 수집 안정성을 보장하기 위한 검증 로직입니다.',
      items: [
        { label: '최대 수집 개수', value: '10개 (상위 노출 기준)', badge: 'MAX_RESULTS' },
        { label: '제목 유효성', value: '5자 이상, 메뉴/검색어 제외' },
        { label: '중복 URL 필터', value: 'Set 자료구조로 중복 제거', badge: '적용됨' },
        { label: '제외 URL 패턴', value: 'PostList, BlogHome, MyBlog, section.blog 등' },
        { label: '플랫폼 감지', value: '네이버블로그, 티스토리, Velog, 브런치' },
        { label: '작성자 추출', value: 'URL 패턴에서 자동 추출', badge: '적용됨' },
      ],
    },
  },
];

const googleLogic: LogicSection[] = [
  {
    id: 'dom',
    title: 'DOM 접근 방식',
    icon: <Code2 className="w-5 h-5" />,
    content: {
      description: 'Firecrawl API를 통해 구글 통합검색 결과 페이지를 마크다운으로 파싱합니다.',
      items: [
        { label: '수집 URL', value: 'google.com/search?q={keyword}&hl=ko&ie=UTF-8', badge: '통합검색' },
        { label: '파싱 대상', value: 'Markdown 링크 패턴 [title](url)' },
        { label: '링크 배열', value: 'Firecrawl links 배열 (출현 순서 보장)' },
        { label: '블로그 도메인', value: 'tistory.com, blog.naver.com, velog.io, brunch.co.kr, medium.com' },
      ],
      codeExample: `/tistory\\.com\\/\\d+/
/tistory\\.com\\/entry\\//
/velog\\.io\\/@[^/]+\\/[^/?]+/
/brunch\\.co\\.kr\\/@[^/]+\\/\\d+/
/medium\\.com\\/[^/]+\\/[^/]+-[a-f0-9]+/`,
    },
  },
  {
    id: 'events',
    title: '이벤트 트리거',
    icon: <MousePointerClick className="w-5 h-5" />,
    content: {
      description: '정적 페이지 스크래핑으로 별도의 이벤트 트리거 없이 초기 로드된 콘텐츠만 수집합니다.',
      items: [
        { label: '페이지 로드 대기', value: '5000ms (waitFor)', badge: '설정됨', badgeVariant: 'secondary' },
        { label: '스크롤 이벤트', value: '없음 - 초기 로드만 수집', badge: '의도적 제한' },
        { label: '클릭 이벤트', value: '없음 - 더보기/다음 페이지 미클릭', badge: '의도적 제한' },
        { label: 'JavaScript 실행', value: 'Firecrawl 내부 처리' },
      ],
    },
  },
  {
    id: 'network',
    title: '네트워크 수집 여부',
    icon: <Wifi className="w-5 h-5" />,
    content: {
      description: 'Firecrawl API를 통한 단일 HTTP 요청으로 수집합니다.',
      items: [
        { label: 'API 엔드포인트', value: 'api.firecrawl.dev/v1/scrape', badge: 'POST' },
        { label: '응답 포맷', value: 'markdown, links 배열' },
        { label: 'XHR/Fetch 인터셉트', value: '없음 - 서버 사이드 렌더링 결과만', badge: 'N/A', badgeVariant: 'outline' },
        { label: '제외 도메인', value: 'google.com/search, youtube.com, maps.google.com 등' },
      ],
    },
  },
  {
    id: 'antibot',
    title: '안티봇 대응 요소',
    icon: <Shield className="w-5 h-5" />,
    content: {
      description: 'Firecrawl의 내장 봇 감지 우회 및 추가 안정화 전략을 적용합니다.',
      items: [
        { label: '랜덤 지연', value: '3~7초 사이 랜덤 딜레이', badge: '적용됨' },
        { label: '엔진 순서 셔플', value: '검색 엔진 요청 순서 무작위화', badge: '적용됨' },
        { label: 'User-Agent', value: 'Firecrawl 기본 로테이션 사용', badge: '자동' },
        { label: 'Headless 브라우저', value: 'Firecrawl 내장 (Playwright 기반)', badge: '자동' },
        { label: 'reCAPTCHA 대응', value: '현재 미지원', badge: '제한', badgeVariant: 'destructive' },
      ],
    },
  },
  {
    id: 'stability',
    title: '안정성 체크 포인트',
    icon: <CheckCircle2 className="w-5 h-5" />,
    content: {
      description: '데이터 품질과 수집 안정성을 보장하기 위한 검증 로직입니다.',
      items: [
        { label: '최대 수집 개수', value: '10개 (상위 노출 기준)', badge: 'MAX_RESULTS' },
        { label: '제목 유효성', value: '5자 이상, http/검색/로그인 제외' },
        { label: '중복 URL 필터', value: 'Set 자료구조로 중복 제거', badge: '적용됨' },
        { label: '포스트 URL 검증', value: '숫자 ID, entry/, @핸들 패턴 필수' },
        { label: '플랫폼 감지', value: '티스토리, 네이버블로그, Velog, 브런치, Medium' },
        { label: '작성자 추출', value: 'URL 패턴에서 자동 추출', badge: '적용됨' },
      ],
    },
  },
];

export default function ScrapingLogicMap() {
  const [selectedEngine, setSelectedEngine] = useState<'naver' | 'google'>('naver');

  const currentLogic = selectedEngine === 'naver' ? naverLogic : googleLogic;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">스크래핑 로직 맵</h1>
            <p className="text-muted-foreground mt-1">
              검색 엔진별 스크래핑 구현 상세 내용을 확인합니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <FileCode className="w-3 h-3" />
              scrape-search/index.ts
            </Badge>
          </div>
        </div>

        {/* Engine Selector */}
        <Tabs value={selectedEngine} onValueChange={(v) => setSelectedEngine(v as 'naver' | 'google')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="naver" className="gap-2">
              <Globe className="w-4 h-4" />
              네이버
            </TabsTrigger>
            <TabsTrigger value="google" className="gap-2">
              <Globe className="w-4 h-4" />
              구글
            </TabsTrigger>
          </TabsList>

          <TabsContent value="naver" className="mt-6">
            <EngineLogicContent engine="naver" logic={naverLogic} />
          </TabsContent>

          <TabsContent value="google" className="mt-6">
            <EngineLogicContent engine="google" logic={googleLogic} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function EngineLogicContent({ engine, logic }: { engine: 'naver' | 'google'; logic: LogicSection[] }) {
  const searchUrl = engine === 'naver' 
    ? 'https://search.naver.com/search.naver?query={keyword}'
    : 'https://www.google.com/search?q={keyword}&hl=ko';

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {engine === 'naver' ? '네이버' : '구글'} 통합검색 수집
            </CardTitle>
            <Badge className="gap-1">
              <Zap className="w-3 h-3" />
              Firecrawl API
            </Badge>
          </div>
          <CardDescription>
            메인 검색 페이지의 초기 로드 결과만 수집 (더보기/추가 로드 없음)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg font-mono">
            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground break-all">{searchUrl}</span>
          </div>
        </CardContent>
      </Card>

      {/* Logic Sections */}
      <Accordion type="multiple" defaultValue={logic.map(l => l.id)} className="space-y-4">
        {logic.map((section) => (
          <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {section.icon}
                </div>
                <span className="font-semibold">{section.title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-muted-foreground text-sm">
                  {section.content.description}
                </p>
                
                <div className="space-y-2">
                  {section.content.items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-sm">{item.value}</span>
                        {item.badge && (
                          <Badge variant={item.badgeVariant || 'default'} className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {section.content.codeExample && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2">URL 패턴 정규식:</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto">
                      {section.content.codeExample}
                    </pre>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Timing Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <span className="font-medium">수집 타이밍:</span>
              <span className="text-muted-foreground ml-2">
                3~7초 랜덤 지연 후 요청 → 5초 페이지 로드 대기 → 결과 파싱
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
