-- =====================================================================
-- crawl_jobs 청크 진행 지원
-- - processed_keyword_ids: 이미 처리한 키워드 ID 누적 (재실행 시 중복 방지)
-- - crawl_date: 오늘 작업인지 빠르게 조회용
-- + stale running 작업 정리 (함수 timeout으로 영영 멈춘 작업들)
-- =====================================================================

ALTER TABLE public.crawl_jobs
  ADD COLUMN IF NOT EXISTS processed_keyword_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS crawl_date date;

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_date_status
  ON public.crawl_jobs(crawl_date, status);

-- 60분 넘게 진행 안 된 running 작업은 함수 timeout으로 죽은 것 → failed로 정리
UPDATE public.crawl_jobs
SET status = 'failed',
    completed_at = COALESCE(completed_at, started_at + INTERVAL '1 hour')
WHERE status = 'running'
  AND started_at < (now() - INTERVAL '60 minutes');
