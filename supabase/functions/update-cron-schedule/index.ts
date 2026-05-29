import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScheduleRequest {
  enabled: boolean;
  time: string; // HH:MM format in KST
}

// Convert KST time to UTC cron expression
function timeToCronExpression(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  // KST is UTC+9, so subtract 9 hours
  const utcHours = (hours - 9 + 24) % 24;
  return `${minutes} ${utcHours} * * *`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { enabled, time }: ScheduleRequest = await req.json();
    const jobName = 'scheduled-blog-crawl';

    // First, unschedule existing job
    try {
      await supabase.rpc('unschedule_cron_job' as never, { job_name: jobName });
    } catch {
      // Try direct SQL if RPC doesn't exist
      const { error } = await supabase.from('_cron_unschedule').select('*');
      if (error) {
        // Use raw query via postgres function
        console.log('Attempting to unschedule via cron.unschedule');
      }
    }

    // Unschedule using direct query
    const unscheduleResult = await fetch(`${supabaseUrl}/rest/v1/rpc/unschedule_cron_job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      },
      body: JSON.stringify({ job_name: jobName }),
    });

    console.log('Unschedule result:', await unscheduleResult.text());

    if (enabled) {
      const cronExpression = timeToCronExpression(time);
      
      // Schedule new job
      const scheduleResult = await fetch(`${supabaseUrl}/rest/v1/rpc/schedule_cron_job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({
          job_name: jobName,
          schedule: cronExpression,
          function_url: `${supabaseUrl}/functions/v1/scheduled-crawl`,
          auth_token: supabaseServiceKey,
          // scheduled-crawl이 X-Cron-Secret 헤더로 무단 호출 차단
          cron_secret: Deno.env.get('CRON_SECRET') || '',
        }),
      });

      const scheduleData = await scheduleResult.text();
      console.log('Schedule result:', scheduleData);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Cron job scheduled: ${cronExpression} (${time} KST)`,
          cronExpression,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: true, message: 'Cron job disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error managing cron schedule:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
