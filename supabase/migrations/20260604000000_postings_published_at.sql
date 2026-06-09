-- 포스팅 발행일(블로그에 업로드된 날짜)
ALTER TABLE public.postings
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

COMMENT ON COLUMN public.postings.published_at IS
  '블로그에 업로드된 날짜. fetch-post-meta 함수가 OG/meta에서 자동 추출하거나 사용자가 직접 지정.';
