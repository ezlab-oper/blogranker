-- =====================================================================
-- blogger_status enum에서 '계약중지속' 제거.
-- Postgres는 enum 값을 직접 DROP할 수 없으므로
--   1) 기존 '계약중지속' 행을 '계약중'으로 이관
--   2) 새 enum 생성 → 컬럼 타입 교체 → 기존 enum drop → 이름 환원
-- =====================================================================

-- 1) 기존 데이터 이관
UPDATE public.bloggers SET status = '계약중' WHERE status = '계약중지속';

-- 2) 새 enum
CREATE TYPE public.blogger_status_new AS ENUM (
  '협의중', '회신대기', '계약중', '계약만료'
);

-- 3) 컬럼 타입 교체
ALTER TABLE public.bloggers
  ALTER COLUMN status TYPE public.blogger_status_new
  USING status::text::public.blogger_status_new;

-- 4) 기존 enum drop
DROP TYPE public.blogger_status;

-- 5) 이름 환원
ALTER TYPE public.blogger_status_new RENAME TO blogger_status;
