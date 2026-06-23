-- 포스팅별 단가. 블로거 unit_price를 기본값으로 prefill하지만 포스팅마다 변동 가능.
ALTER TABLE public.postings
  ADD COLUMN IF NOT EXISTS unit_price INTEGER;
