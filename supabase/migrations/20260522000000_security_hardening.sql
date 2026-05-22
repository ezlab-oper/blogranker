-- =====================================================================
-- 보안 강화 (P1)
-- 1) 전 테이블의 익명 공개 정책(USING true) 제거 → 로그인(authenticated) 전용으로 전환
-- 2) cron 스케줄 함수의 anon/authenticated EXECUTE 권한 회수
--    (Edge Function은 service_role 키로 호출하므로 영향 없음)
--
-- 주의: 이 앱은 로그인을 요구하는 내부 관리자 도구다.
--       클라이언트는 anon 키 + 로그인 세션으로 동작하므로 세션이 있으면 'authenticated' 롤이 된다.
--       세션이 없는(로그아웃) 익명 요청은 모든 데이터 접근이 차단된다.
--       viewer 롤의 쓰기 제한은 현재 클라이언트단에서 처리하며, DB단 세분화는 후속 과제(P2)로 둔다.
-- =====================================================================

-- ---------- keyword_categories ----------
DROP POLICY IF EXISTS "Allow all access to keyword_categories" ON public.keyword_categories;
CREATE POLICY "Authenticated full access to keyword_categories"
  ON public.keyword_categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------- keywords ----------
DROP POLICY IF EXISTS "Allow all access to keywords" ON public.keywords;
CREATE POLICY "Authenticated full access to keywords"
  ON public.keywords FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------- search_engines ----------
DROP POLICY IF EXISTS "Allow all access to search_engines" ON public.search_engines;
CREATE POLICY "Authenticated full access to search_engines"
  ON public.search_engines FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------- crawl_jobs ----------
DROP POLICY IF EXISTS "Allow all access to crawl_jobs" ON public.crawl_jobs;
CREATE POLICY "Authenticated full access to crawl_jobs"
  ON public.crawl_jobs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------- crawl_results ----------
DROP POLICY IF EXISTS "Allow all access to crawl_results" ON public.crawl_results;
CREATE POLICY "Authenticated full access to crawl_results"
  ON public.crawl_results FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------- settings ----------
DROP POLICY IF EXISTS "Allow all access to settings" ON public.settings;
CREATE POLICY "Authenticated full access to settings"
  ON public.settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------- usage_logs ----------
DROP POLICY IF EXISTS "Allow all access to usage_logs" ON public.usage_logs;
CREATE POLICY "Authenticated full access to usage_logs"
  ON public.usage_logs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------- blog_urls ----------
DROP POLICY IF EXISTS "Allow all access to blog_urls" ON public.blog_urls;
CREATE POLICY "Authenticated full access to blog_urls"
  ON public.blog_urls FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------- cron 함수 권한 회수 ----------
-- 익명/일반 사용자가 임의 URL·토큰으로 cron 작업을 등록할 수 없도록 EXECUTE 권한 회수
REVOKE EXECUTE ON FUNCTION public.schedule_cron_job(text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unschedule_cron_job(text) FROM anon, authenticated;
