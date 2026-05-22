-- =====================================================================
-- RLS 롤 세분화 (P2)
-- 직전 마이그레이션(20260522000000)에서 전 테이블을 authenticated 전용으로 막았다.
-- 이번엔 롤별로 권한을 나눈다.
--
--   master  : 모든 테이블 읽기/쓰기 + settings 쓰기
--   admin   : 데이터 테이블 읽기/쓰기 (settings 쓰기 불가)
--   viewer  : 전 테이블 읽기 전용 (+ usage_logs 트래킹 쓰기만 허용)
--
-- 정책 구성: 읽기는 모든 authenticated 허용, 쓰기는 롤 체크 정책으로 분리.
-- (Postgres의 다중 permissive 정책은 OR로 결합되므로 SELECT는 read 정책으로 통과)
-- =====================================================================

-- 편집 권한(admin 또는 master) 헬퍼
CREATE OR REPLACE FUNCTION public.is_editor(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin') OR public.has_role(_uid, 'master')
$$;

-- master 권한 헬퍼
CREATE OR REPLACE FUNCTION public.is_master(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'master')
$$;

-- ---------------------------------------------------------------------
-- 데이터 테이블: 읽기=전체 authenticated, 쓰기=editor(admin|master)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'keyword_categories', 'keywords', 'search_engines',
    'crawl_jobs', 'crawl_results', 'blog_urls'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- 직전 마이그레이션의 통합 정책 제거
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access to %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "read %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "write %s" ON public.%I', t, t);

    -- 읽기: 모든 로그인 사용자(viewer 포함)
    EXECUTE format(
      'CREATE POLICY "read %s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);

    -- 쓰기(INSERT/UPDATE/DELETE): editor 전용
    EXECUTE format(
      'CREATE POLICY "write %s" ON public.%I FOR ALL TO authenticated '
      || 'USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()))', t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- settings: 읽기=전체 authenticated, 쓰기=master 전용
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to settings" ON public.settings;
DROP POLICY IF EXISTS "read settings" ON public.settings;
DROP POLICY IF EXISTS "write settings" ON public.settings;

CREATE POLICY "read settings"
  ON public.settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "write settings"
  ON public.settings FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

-- ---------------------------------------------------------------------
-- usage_logs: 트래킹 특성상 모든 로그인 사용자 읽기/쓰기 허용 (직전 정책 유지)
-- 단, DELETE만 editor로 제한한다.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to usage_logs" ON public.usage_logs;
DROP POLICY IF EXISTS "read usage_logs" ON public.usage_logs;
DROP POLICY IF EXISTS "track usage_logs" ON public.usage_logs;
DROP POLICY IF EXISTS "delete usage_logs" ON public.usage_logs;

CREATE POLICY "read usage_logs"
  ON public.usage_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "track usage_logs insert"
  ON public.usage_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "track usage_logs update"
  ON public.usage_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete usage_logs"
  ON public.usage_logs FOR DELETE TO authenticated
  USING (public.is_editor(auth.uid()));
