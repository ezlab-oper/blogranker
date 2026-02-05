-- Create usage_logs table for daily usage tracking
CREATE TABLE public.usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  database_rows BIGINT DEFAULT 0,
  database_size_mb NUMERIC(10,2) DEFAULT 0,
  storage_size_mb NUMERIC(10,2) DEFAULT 0,
  edge_function_invocations INTEGER DEFAULT 0,
  api_requests INTEGER DEFAULT 0,
  bandwidth_mb NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Enable RLS
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Allow all access (this is internal monitoring data)
CREATE POLICY "Allow all access to usage_logs" 
ON public.usage_logs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_usage_logs_updated_at
BEFORE UPDATE ON public.usage_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get database stats
CREATE OR REPLACE FUNCTION public.get_database_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_rows', (
      SELECT COALESCE(SUM(n_live_tup), 0)
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    ),
    'table_stats', (
      SELECT json_agg(json_build_object(
        'table_name', relname,
        'row_count', n_live_tup,
        'size_bytes', pg_total_relation_size(schemaname || '.' || relname)
      ))
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;