-- Add api_requests_by_feature column to store feature-wise API counts
ALTER TABLE public.usage_logs 
ADD COLUMN IF NOT EXISTS api_requests_by_feature jsonb DEFAULT '{}'::jsonb;