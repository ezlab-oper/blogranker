-- 외부 블로거 판정에 "협업 블로거 = status='계약됨' 블로거"만 제외하도록 변경.
-- 협업 요청·협업 거절·계약만료 블로거는 다시 외부 풀에 노출된다 (재제안·모니터링 목적).

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
  -- 우리 측 blog_id 집합 = 계약됨 블로거 + 공식
  SELECT array_agg(DISTINCT bid)
    INTO our_bids
    FROM (
      SELECT blog_id AS bid
      FROM public.bloggers
      WHERE blog_id IS NOT NULL AND blog_id <> ''
        AND status = '계약됨'
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

-- 새 정의로 즉시 갱신
SELECT public.refresh_top_external_bloggers();
