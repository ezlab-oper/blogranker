-- BloggerStatus enum 값 라벨 변경.
-- 협의중 → 협업 요청 (메일 보낸 상태)
-- 회신대기 → 협업 거절 (블로거가 거절)
-- 계약중 → 계약됨 (현재 협업 중)
-- 계약만료는 그대로.
--
-- enum value rename은 in-place 즉시 반영. 기존 row의 ID가 그대로 새 라벨에 매핑된다.
-- PostgreSQL 14+ 부터 RENAME VALUE를 트랜잭션 안에서 실행할 수 있다. Supabase 15.

ALTER TYPE public.blogger_status RENAME VALUE '협의중' TO '협업 요청';
ALTER TYPE public.blogger_status RENAME VALUE '회신대기' TO '협업 거절';
ALTER TYPE public.blogger_status RENAME VALUE '계약중' TO '계약됨';
