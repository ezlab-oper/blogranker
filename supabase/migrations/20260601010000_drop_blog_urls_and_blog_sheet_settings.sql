-- 시트 동기화(blog_urls) 제거. postings + bloggers를 단일 소스로 사용.
-- 협업 매칭은 postings.posting_url(정확 일치) + bloggers.blog_id(같은 블로거의 다른 글)로 처리.

drop table if exists public.blog_urls cascade;

delete from public.settings where key = 'blogSheet';
