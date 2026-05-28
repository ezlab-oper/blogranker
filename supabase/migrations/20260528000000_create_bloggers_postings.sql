-- =====================================================================
-- 블로그 포스팅 도메인: 협업 블로거 + 포스팅 관리
-- 기존 blog_urls(시트 동기화)와 별도 시스템 (영향 없음)
-- =====================================================================

-- 블로그 지수 (순서 의미 있음: 최적화3 > 최적화2 > ... > 저품질)
CREATE TYPE public.blog_grade AS ENUM (
  '최적화3', '최적화2', '최적화1',
  '준최적6', '준최적5', '준최적4', '준최적3', '준최적2', '준최적1',
  '일반', '저품질'
);

-- 블로거 상태
CREATE TYPE public.blogger_status AS ENUM (
  '협의중', '회신대기', '계약중', '계약중지속', '계약만료'
);

-- bloggers
CREATE TABLE public.bloggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  blog_url text NOT NULL,
  blog_id text,                 -- URL에서 추출 (매칭용)
  email text,
  unit_price integer,           -- 원 단위
  status blogger_status,
  contract_end_date date,
  blog_grade blog_grade,
  is_influencer boolean DEFAULT false,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bloggers_blog_id ON public.bloggers(blog_id);
CREATE INDEX idx_bloggers_name ON public.bloggers(name);

-- postings
CREATE TABLE public.postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blogger_id uuid REFERENCES public.bloggers(id) ON DELETE SET NULL,
  posting_url text NOT NULL UNIQUE,
  blog_id text,                 -- URL에서 추출
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_postings_blogger_id ON public.postings(blogger_id);
CREATE INDEX idx_postings_blog_id ON public.postings(blog_id);

-- updated_at 트리거
CREATE TRIGGER update_bloggers_updated_at BEFORE UPDATE ON public.bloggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_postings_updated_at BEFORE UPDATE ON public.postings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: 읽기=전 authenticated, 쓰기=editor(admin|master)
ALTER TABLE public.bloggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read bloggers" ON public.bloggers FOR SELECT TO authenticated USING (true);
CREATE POLICY "write bloggers" ON public.bloggers FOR ALL TO authenticated
  USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));

CREATE POLICY "read postings" ON public.postings FOR SELECT TO authenticated USING (true);
CREATE POLICY "write postings" ON public.postings FOR ALL TO authenticated
  USING (public.is_editor(auth.uid())) WITH CHECK (public.is_editor(auth.uid()));
