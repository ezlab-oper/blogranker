-- Drop and recreate the check constraint to include 'cancelled' status
ALTER TABLE public.crawl_jobs DROP CONSTRAINT IF EXISTS crawl_jobs_status_check;

ALTER TABLE public.crawl_jobs ADD CONSTRAINT crawl_jobs_status_check 
CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));