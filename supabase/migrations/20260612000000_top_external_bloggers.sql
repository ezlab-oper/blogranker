-- ============================================================================
-- 상위노출 블로거 (외부 블로거 발굴) — 사전 집계 테이블 + 매일 갱신 함수
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) blog_url → blog_id 추출 (TS extractBlogId의 SQL 버전)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extract_blog_id_from_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  host TEXT;
  path TEXT;
  m TEXT[];
BEGIN
  IF url IS NULL OR url = '' THEN RETURN NULL; END IF;
  host := substring(url FROM '^https?://([^/]+)');
  path := substring(url FROM '^https?://[^/]+(/.*)');
  IF host IS NULL THEN RETURN NULL; END IF;

  IF host IN ('blog.naver.com', 'm.blog.naver.com') THEN
    -- /{blogId}/{postId}
    RETURN NULLIF(split_part(trim(leading '/' FROM coalesce(path, '')), '/', 1), '');
  ELSIF host LIKE '%.tistory.com' THEN
    RETURN replace(host, '.tistory.com', '');
  ELSIF host = 'velog.io' THEN
    m := regexp_matches(coalesce(path, ''), '^/@([^/]+)');
    RETURN m[1];
  ELSIF host LIKE 'brunch.co.kr%' OR host = 'brunch.co.kr' THEN
    m := regexp_matches(coalesce(path, ''), '^/@([^/]+)');
    RETURN m[1];
  ELSE
    RETURN host;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) blog_url → 플랫폼명
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detect_blog_platform(url TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN url IS NULL THEN NULL
    WHEN url LIKE '%blog.naver.com%' THEN '네이버블로그'
    WHEN url LIKE '%tistory.com%' THEN '티스토리'
    WHEN url LIKE '%velog.io%' THEN 'Velog'
    WHEN url LIKE '%brunch.co.kr%' THEN '브런치'
    WHEN url LIKE '%medium.com%' THEN 'Medium'
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- 3) 사전 집계 테이블
--    행 단위 = (period_days, blog_id, program)
--      program = '__ALL__' → 전체 프로그램 합산 행 (program 필터 '전체'일 때 SELECT)
--      program = '미지정'  → keywords.program이 NULL인 키워드만으로 집계
--      그 외        → 해당 program으로 한정
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.top_external_bloggers (
  period_days       INT          NOT NULL CHECK (period_days IN (7, 14, 30)),
  blog_id           TEXT         NOT NULL,
  program           TEXT         NOT NULL DEFAULT '__ALL__',
  author_name       TEXT,
  platform          TEXT,
  hit_keywords      TEXT[]       NOT NULL DEFAULT '{}',
  hit_keyword_count INT          NOT NULL DEFAULT 0,
  total_appearances INT          NOT NULL DEFAULT 0,
  best_rank         INT          NOT NULL,
  avg_rank          NUMERIC(4,2) NOT NULL,
  engines           TEXT[]       NOT NULL DEFAULT '{}',
  last_seen_at      TIMESTAMPTZ  NOT NULL,
  sample_post_url   TEXT,
  computed_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (period_days, blog_id, program)
);

CREATE INDEX IF NOT EXISTS idx_teb_lookup
  ON public.top_external_bloggers (period_days, program, hit_keyword_count DESC, avg_rank ASC);

-- RLS — viewer 이상 read, 쓰기는 함수(SECURITY DEFINER)에서만.
ALTER TABLE public.top_external_bloggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read top_external_bloggers" ON public.top_external_bloggers;
CREATE POLICY "read top_external_bloggers" ON public.top_external_bloggers
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE는 정책 없음 → service_role + SECURITY DEFINER 함수만 쓸 수 있음.

-- ---------------------------------------------------------------------------
-- 4) 갱신 함수 — 7/14/30일 × (program별 + 전체합산) 모두 INSERT
--    crawl_results 전체 스캔 + bloggers/공식블로그 제외 + 활성 키워드만.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_top_external_bloggers()
RETURNS TABLE(period_days INT, rows_inserted BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  our_bids   TEXT[];
  p          INT;
  n1         BIGINT;
  n2         BIGINT;
BEGIN
  -- 우리 측 blog_id 집합 (협업 블로거 + 공식)
  SELECT array_agg(DISTINCT bid)
    INTO our_bids
    FROM (
      SELECT blog_id AS bid
      FROM public.bloggers
      WHERE blog_id IS NOT NULL AND blog_id <> ''
      UNION
      SELECT 'ezlab_official'
    ) s;

  IF our_bids IS NULL THEN our_bids := ARRAY['ezlab_official']; END IF;

  TRUNCATE public.top_external_bloggers;

  FOREACH p IN ARRAY ARRAY[7, 14, 30] LOOP

    -- (a) program별 행
    WITH base AS (
      SELECT
        public.extract_blog_id_from_url(cr.blog_url) AS bid,
        cr.blog_url,
        cr.blog_author,
        cr.rank,
        cr.crawled_at,
        k.keyword,
        COALESCE(NULLIF(k.program, ''), '미지정') AS program,
        e.name AS engine_name
      FROM public.crawl_results cr
      JOIN public.keywords k ON k.id = cr.keyword_id AND k.is_active = TRUE
      JOIN public.search_engines e ON e.id = cr.search_engine_id
      WHERE cr.crawled_at >= now() - (p::text || ' days')::interval
    ),
    filtered AS (
      SELECT * FROM base
      WHERE bid IS NOT NULL AND NOT (bid = ANY (our_bids))
    )
    INSERT INTO public.top_external_bloggers (
      period_days, blog_id, program, author_name, platform,
      hit_keywords, hit_keyword_count, total_appearances,
      best_rank, avg_rank, engines, last_seen_at, sample_post_url
    )
    SELECT
      p,
      bid,
      program,
      MIN(blog_author) FILTER (WHERE blog_author IS NOT NULL AND blog_author <> ''),
      MIN(public.detect_blog_platform(blog_url)),
      array_agg(DISTINCT keyword ORDER BY keyword),
      COUNT(DISTINCT keyword)::INT,
      COUNT(*)::INT,
      MIN(rank)::INT,
      ROUND(AVG(rank)::numeric, 2),
      array_agg(DISTINCT engine_name ORDER BY engine_name),
      MAX(crawled_at),
      (array_agg(blog_url ORDER BY crawled_at DESC))[1]
    FROM filtered
    GROUP BY bid, program;

    GET DIAGNOSTICS n1 = ROW_COUNT;

    -- (b) 전체 합산 행 (program='__ALL__')
    WITH base AS (
      SELECT
        public.extract_blog_id_from_url(cr.blog_url) AS bid,
        cr.blog_url,
        cr.blog_author,
        cr.rank,
        cr.crawled_at,
        k.keyword,
        e.name AS engine_name
      FROM public.crawl_results cr
      JOIN public.keywords k ON k.id = cr.keyword_id AND k.is_active = TRUE
      JOIN public.search_engines e ON e.id = cr.search_engine_id
      WHERE cr.crawled_at >= now() - (p::text || ' days')::interval
    ),
    filtered AS (
      SELECT * FROM base
      WHERE bid IS NOT NULL AND NOT (bid = ANY (our_bids))
    )
    INSERT INTO public.top_external_bloggers (
      period_days, blog_id, program, author_name, platform,
      hit_keywords, hit_keyword_count, total_appearances,
      best_rank, avg_rank, engines, last_seen_at, sample_post_url
    )
    SELECT
      p,
      bid,
      '__ALL__',
      MIN(blog_author) FILTER (WHERE blog_author IS NOT NULL AND blog_author <> ''),
      MIN(public.detect_blog_platform(blog_url)),
      array_agg(DISTINCT keyword ORDER BY keyword),
      COUNT(DISTINCT keyword)::INT,
      COUNT(*)::INT,
      MIN(rank)::INT,
      ROUND(AVG(rank)::numeric, 2),
      array_agg(DISTINCT engine_name ORDER BY engine_name),
      MAX(crawled_at),
      (array_agg(blog_url ORDER BY crawled_at DESC))[1]
    FROM filtered
    GROUP BY bid;

    GET DIAGNOSTICS n2 = ROW_COUNT;
    period_days   := p;
    rows_inserted := n1 + n2;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_top_external_bloggers() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) pg_cron — 매일 09:30 KST (= 00:30 UTC).
--    scheduled-crawl 첫 청크가 06:00에 시작해 보통 09시 전에 끝나므로
--    그 직후에 갱신하면 그날 데이터가 반영된다.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- pg_cron이 활성화돼 있을 때만 등록 (로컬 dev 환경 대응)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-top-external-bloggers')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-top-external-bloggers');
    PERFORM cron.schedule(
      'refresh-top-external-bloggers',
      '30 0 * * *',
      $job$SELECT public.refresh_top_external_bloggers()$job$
    );
  END IF;
END $$;
