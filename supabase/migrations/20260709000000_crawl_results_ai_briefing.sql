-- AI 브리핑 블로그를 organic 순위와 분리 저장하기 위한 플래그.
-- 기존 행은 전부 organic(false)으로 간주 (과거 데이터 재분류 불가).
ALTER TABLE public.crawl_results
  ADD COLUMN IF NOT EXISTS is_ai_briefing boolean NOT NULL DEFAULT false;

-- organic 조회(순위/통계/추이)가 브리핑 행을 제외할 때 쓰는 부분 인덱스.
CREATE INDEX IF NOT EXISTS idx_crawl_results_organic
  ON public.crawl_results (keyword_id, crawled_at)
  WHERE is_ai_briefing = false;
