-- bloggers.blog_url에 UNIQUE 제약 추가.
-- CollaborationCompose에서 upsert(onConflict:'blog_url')로 협업 요청 등록 시 필요.
-- 기존 데이터(17행)에는 중복 없음 확인 후 적용.

ALTER TABLE public.bloggers
  ADD CONSTRAINT bloggers_blog_url_key UNIQUE (blog_url);
