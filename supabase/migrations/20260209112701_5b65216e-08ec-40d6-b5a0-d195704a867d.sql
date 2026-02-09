
-- Table to cache blog URLs from Google Sheets
CREATE TABLE public.blog_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program TEXT NOT NULL,
  blog_url TEXT NOT NULL,
  blog_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_blog_urls_program ON public.blog_urls(program);
CREATE INDEX idx_blog_urls_blog_url ON public.blog_urls(blog_url);
CREATE INDEX idx_blog_urls_blog_id ON public.blog_urls(blog_id);

-- Enable RLS
ALTER TABLE public.blog_urls ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access (same pattern as other tables)
CREATE POLICY "Allow all access to blog_urls"
  ON public.blog_urls
  FOR ALL
  USING (true)
  WITH CHECK (true);
