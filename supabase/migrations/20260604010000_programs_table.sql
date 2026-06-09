-- 프로그램 목록 관리 — 키워드/포스팅의 program 컬럼이 참조하는 마스터 데이터.
-- 정적 상수(PROGRAMS = ['이지캡쳐', ...]) 대체.

CREATE TABLE IF NOT EXISTS public.programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programs_sort ON public.programs(sort_order, name);

-- updated_at 자동 갱신
DROP TRIGGER IF EXISTS update_programs_updated_at ON public.programs;
CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: viewer 읽기, admin/master 쓰기
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read programs" ON public.programs;
CREATE POLICY "read programs" ON public.programs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "write programs" ON public.programs;
CREATE POLICY "write programs" ON public.programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'admin'));

-- 기존 PROGRAMS 상수 시드
INSERT INTO public.programs (name, sort_order) VALUES
  ('이지캡쳐', 10),
  ('이지집', 20),
  ('이지메모', 30),
  ('이지파인더', 40),
  ('이지캠', 50),
  ('이지리더', 60)
ON CONFLICT (name) DO NOTHING;
