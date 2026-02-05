-- 키워드 카테고리 테이블
CREATE TABLE public.keyword_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 키워드 테이블
CREATE TABLE public.keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL,
  category_id UUID REFERENCES public.keyword_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(keyword)
);

-- 검색 엔진 테이블
CREATE TABLE public.search_engines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 크롤링 작업 테이블
CREATE TABLE public.crawl_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_keywords INTEGER NOT NULL DEFAULT 0,
  processed_keywords INTEGER NOT NULL DEFAULT 0,
  successful_keywords INTEGER NOT NULL DEFAULT 0,
  failed_keywords INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 크롤링 결과 테이블
CREATE TABLE public.crawl_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  search_engine_id UUID NOT NULL REFERENCES public.search_engines(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  blog_title TEXT NOT NULL,
  blog_author TEXT,
  blog_url TEXT NOT NULL,
  snippet TEXT,
  published_date TEXT,
  blog_platform TEXT,
  thumbnail_url TEXT,
  crawled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX idx_crawl_results_keyword_id ON public.crawl_results(keyword_id);
CREATE INDEX idx_crawl_results_search_engine_id ON public.crawl_results(search_engine_id);
CREATE INDEX idx_crawl_results_crawled_at ON public.crawl_results(crawled_at);
CREATE INDEX idx_crawl_results_job_id ON public.crawl_results(job_id);
CREATE INDEX idx_keywords_category_id ON public.keywords(category_id);
CREATE INDEX idx_keywords_is_active ON public.keywords(is_active);

-- RLS 활성화 (공개 접근 허용 - 인증 불필요)
ALTER TABLE public.keyword_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_engines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_results ENABLE ROW LEVEL SECURITY;

-- 공개 접근 정책 (이 시스템은 내부 도구로 사용)
CREATE POLICY "Allow all access to keyword_categories" ON public.keyword_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to keywords" ON public.keywords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to search_engines" ON public.search_engines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to crawl_jobs" ON public.crawl_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to crawl_results" ON public.crawl_results FOR ALL USING (true) WITH CHECK (true);

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 트리거 생성
CREATE TRIGGER update_keyword_categories_updated_at
  BEFORE UPDATE ON public.keyword_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at
  BEFORE UPDATE ON public.keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();