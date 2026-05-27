-- =====================================================================
-- search_engines에 '구글' 시드 (네이버에 이어 구글 검색결과 1페이지 수집 활성화)
-- =====================================================================

INSERT INTO public.search_engines (name, base_url, is_active)
VALUES ('구글', 'https://www.google.com/search', true)
ON CONFLICT (name) DO NOTHING;
