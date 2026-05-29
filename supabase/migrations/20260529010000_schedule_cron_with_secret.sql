-- =====================================================================
-- schedule_cron_job에 cron_secret 인자 추가 → cron이 호출 시 X-Cron-Secret 헤더 박힘
-- scheduled-crawl이 이 secret으로 무단 호출 차단
-- =====================================================================

DROP FUNCTION IF EXISTS public.schedule_cron_job(text, text, text, text);

CREATE OR REPLACE FUNCTION public.schedule_cron_job(
  job_name TEXT,
  schedule TEXT,
  function_url TEXT,
  auth_token TEXT,
  cron_secret TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_id BIGINT;
  headers_json TEXT;
BEGIN
  -- 동일 job_name 이미 있으면 제거
  BEGIN
    PERFORM cron.unschedule(job_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  headers_json := format('{"Content-Type": "application/json", "Authorization": "Bearer %s"', auth_token);
  IF cron_secret IS NOT NULL AND cron_secret <> '' THEN
    headers_json := headers_json || format(', "X-Cron-Secret": "%s"', cron_secret);
  END IF;
  headers_json := headers_json || '}';

  SELECT cron.schedule(
    job_name,
    schedule,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb) AS request_id;',
      function_url,
      headers_json
    )
  ) INTO job_id;

  RETURN job_id;
END;
$$;

-- 함수는 service_role(supabase 내부)만 사용
REVOKE EXECUTE ON FUNCTION public.schedule_cron_job(text, text, text, text, text) FROM anon, authenticated;
