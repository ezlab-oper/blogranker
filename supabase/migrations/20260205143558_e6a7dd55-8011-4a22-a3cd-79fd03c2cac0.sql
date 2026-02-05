
-- Create function to schedule cron job
CREATE OR REPLACE FUNCTION public.schedule_cron_job(
  job_name TEXT,
  schedule TEXT,
  function_url TEXT,
  auth_token TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_id BIGINT;
BEGIN
  -- First try to unschedule if exists
  BEGIN
    PERFORM cron.unschedule(job_name);
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if doesn't exist
    NULL;
  END;
  
  -- Schedule new job
  SELECT cron.schedule(
    job_name,
    schedule,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb) AS request_id;',
      function_url,
      format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}', auth_token)
    )
  ) INTO job_id;
  
  RETURN job_id;
END;
$$;

-- Create function to unschedule cron job
CREATE OR REPLACE FUNCTION public.unschedule_cron_job(job_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM cron.unschedule(job_name);
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.schedule_cron_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.unschedule_cron_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_cron_job TO anon;
GRANT EXECUTE ON FUNCTION public.unschedule_cron_job TO anon;
