-- =====================================================================
-- postings 테이블에 program(제품)과 target_keywords(의뢰 키워드 배열) 추가
-- 의뢰 키워드 vs 실제 추적 중인 키워드의 매칭 검증·ROI 분석에 활용
-- =====================================================================

ALTER TABLE public.postings
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS target_keywords text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_postings_program ON public.postings(program);
