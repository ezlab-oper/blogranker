-- =====================================================================
-- 사용량 모니터링 제거
-- 앱의 Usage 페이지/apiTracker가 자체 카운트하던 usage_logs를 폐기한다.
-- 실제 리소스 사용량은 Supabase/Netlify 대시보드에서 확인한다.
-- =====================================================================

-- 사용량 수집용 통계 함수 제거
DROP FUNCTION IF EXISTS public.get_database_stats();

-- usage_logs 테이블 제거 (정책·트리거 함께 삭제됨)
DROP TABLE IF EXISTS public.usage_logs CASCADE;
