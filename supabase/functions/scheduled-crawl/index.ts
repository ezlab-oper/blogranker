import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleSettings {
  enabled: boolean;
  time: string;
  interval: number;
}

interface NotificationSettings {
  slackWebhook: string;
  onComplete: boolean;
  onError: boolean;
}

// Utility function for random delay
function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Send Slack notification
async function sendSlackNotification(
  webhookUrl: string,
  message: string,
  isError: boolean = false
): Promise<void> {
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${isError ? '❌' : '✅'} [블로그 순위 추적기] ${message}`,
        attachments: [
          {
            color: isError ? '#ff0000' : '#00ff00',
            text: message,
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      }),
    });
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Scheduled crawl triggered at:', new Date().toISOString());

    // Get schedule settings
    const { data: scheduleData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'schedule')
      .single();

    const scheduleSettings: ScheduleSettings = scheduleData?.value || { enabled: false };

    if (!scheduleSettings.enabled) {
      console.log('Scheduled crawl is disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Scheduled crawl is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get notification settings
    const { data: notificationData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'notifications')
      .single();

    const notificationSettings: NotificationSettings = notificationData?.value || {
      slackWebhook: '',
      onComplete: false,
      onError: false,
    };

    // Get active keywords
    const { data: keywords, error: keywordsError } = await supabase
      .from('keywords')
      .select('*')
      .eq('is_active', true);

    if (keywordsError) throw keywordsError;

    if (!keywords || keywords.length === 0) {
      console.log('No active keywords to crawl');
      return new Response(
        JSON.stringify({ success: true, message: 'No active keywords' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active search engines
    const { data: engines, error: enginesError } = await supabase
      .from('search_engines')
      .select('*')
      .eq('is_active', true);

    if (enginesError) throw enginesError;

    // Create crawl job
    const { data: job, error: jobError } = await supabase
      .from('crawl_jobs')
      .insert({
        status: 'running',
        total_keywords: keywords.length,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;

    let successCount = 0;
    let failCount = 0;
    const totalTasks = keywords.length * (engines?.length || 0);

    // Process keywords with randomized patterns
    for (const keyword of keywords) {
      // Shuffle engines for each keyword
      const shuffledEngines = shuffleArray(engines || []);

      for (const engine of shuffledEngines) {
        try {
          // Random delay between requests (3-7 seconds)
          await randomDelay(3000, 7000);

          const engineType = engine.name.toLowerCase().includes('google') ? 'google' : 'naver';

          // Call scrape-search function
          const response = await fetch(`${supabaseUrl}/functions/v1/scrape-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              keyword: keyword.keyword,
              engine: engineType,
            }),
          });

          const data = await response.json();

          if (data.success && data.results) {
            // Save results
            for (const result of data.results) {
              await supabase.from('crawl_results').insert({
                job_id: job.id,
                keyword_id: keyword.id,
                search_engine_id: engine.id,
                rank: result.rank,
                blog_title: result.title,
                blog_author: result.author,
                blog_url: result.url,
                snippet: result.snippet,
                published_date: result.published_date,
                blog_platform: result.platform,
                thumbnail_url: result.thumbnail_url,
              });
            }
            successCount++;
          } else {
            failCount++;
            console.error(`Failed to scrape ${keyword.keyword} on ${engine.name}:`, data.error);
          }
        } catch (error) {
          failCount++;
          console.error(`Error processing ${keyword.keyword} on ${engine.name}:`, error);
        }

        // Additional random delay between engines (1-3 seconds)
        await randomDelay(1000, 3000);
      }

      // Update job progress
      await supabase
        .from('crawl_jobs')
        .update({
          processed_keywords: successCount + failCount,
          successful_keywords: successCount,
          failed_keywords: failCount,
        })
        .eq('id', job.id);
    }

    // Complete job
    const finalStatus = failCount === 0 ? 'completed' : failCount === totalTasks ? 'failed' : 'completed';
    await supabase
      .from('crawl_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        processed_keywords: successCount + failCount,
        successful_keywords: successCount,
        failed_keywords: failCount,
      })
      .eq('id', job.id);

    // Send notification
    const message = `스케줄 수집 ${finalStatus === 'completed' ? '완료' : '실패'}: ${successCount}/${totalTasks} 성공`;
    
    if (finalStatus === 'completed' && notificationSettings.onComplete) {
      await sendSlackNotification(notificationSettings.slackWebhook, message, false);
    } else if (finalStatus === 'failed' && notificationSettings.onError) {
      await sendSlackNotification(notificationSettings.slackWebhook, message, true);
    }

    console.log('Scheduled crawl completed:', message);

    return new Response(
      JSON.stringify({
        success: true,
        message,
        job_id: job.id,
        stats: { success: successCount, failed: failCount, total: totalTasks },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scheduled crawl error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
