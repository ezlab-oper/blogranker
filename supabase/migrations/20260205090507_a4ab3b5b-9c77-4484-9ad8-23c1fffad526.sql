-- Create settings table for storing application configuration
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (since this is a single-user app without auth)
CREATE POLICY "Allow all access to settings" 
ON public.settings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
('schedule', '{"time": "09:00", "interval": 5, "enabled": true}'::jsonb, '자동 수집 스케줄 설정'),
('notifications', '{"slackWebhook": "", "onComplete": false, "onError": true}'::jsonb, '알림 설정'),
('scraping', '{"maxRetries": 3, "userAgentRotation": true}'::jsonb, '스크래핑 설정');