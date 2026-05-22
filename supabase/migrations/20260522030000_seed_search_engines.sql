-- =====================================================================
-- search_engines 기본 시드
-- 크롤 로직(scraper.ts / scheduled-crawl)은 name='네이버' 인 활성 엔진을 요구한다.
-- 빈 DB로 신규 시작했으므로 기본 네이버 엔진을 1건 삽입한다. (멱등)
-- =====================================================================

INSERT INTO public.search_engines (name, base_url, is_active)
VALUES ('네이버', 'https://search.naver.com/search.naver', true)
ON CONFLICT (name) DO NOTHING;
