-- bloggers.requested_at: 협업 요청 메일을 보낸 시각.
-- 협업 요청 페이지에서 최신순 정렬 키. CollaborationCompose가 upsert 시 갱신한다.

ALTER TABLE public.bloggers
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;

-- 기존에 status='협업 요청' 상태인 행은 updated_at으로 backfill.
UPDATE public.bloggers
   SET requested_at = updated_at
 WHERE status = '협업 요청'
   AND requested_at IS NULL;

COMMENT ON COLUMN public.bloggers.requested_at IS
  '협업 요청 메일을 보낸 시각. 협업 요청 페이지 최신순 정렬 키. 계약됨 전환 시에도 보존(이력 추적).';
