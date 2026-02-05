import { supabase } from '@/integrations/supabase/client';

interface BlogResult {
  rank: number;
  title: string;
  author: string | null;
  url: string;
  snippet: string | null;
  published_date: string | null;
  platform: string | null;
  thumbnail_url: string | null;
}

interface ScrapeResponse {
  success: boolean;
  keyword?: string;
  engine?: string;
  results?: BlogResult[];
  error?: string;
}

export interface CrawlProgress {
  currentKeyword: string;
  currentEngine: string;
  processed: number;
  total: number;
  successful: number;
  failed: number;
}

export async function scrapeKeyword(
  keyword: string,
  engine: 'naver' | 'google'
): Promise<ScrapeResponse> {
  const { data, error } = await supabase.functions.invoke('scrape-search', {
    body: { keyword, engine },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

export async function runCrawlJob(
  keywordIds: string[],
  onProgress?: (progress: CrawlProgress) => void
): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  // Create a new crawl job
  const { data: job, error: jobError } = await supabase
    .from('crawl_jobs')
    .insert({
      status: 'running',
      total_keywords: keywordIds.length,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobError || !job) {
    return { success: false, error: jobError?.message || 'Failed to create job' };
  }

  // Get keywords
  const { data: keywords } = await supabase
    .from('keywords')
    .select('*')
    .in('id', keywordIds)
    .eq('is_active', true);

  // Get search engines
  const { data: engines } = await supabase
    .from('search_engines')
    .select('*')
    .eq('is_active', true);

  if (!keywords || !engines) {
    return { success: false, error: 'Failed to fetch keywords or engines' };
  }

  let processed = 0;
  let successful = 0;
  let failed = 0;
  const totalOperations = keywords.length * engines.length;

  // Process each keyword for each engine
  for (const kw of keywords) {
    for (const engine of engines) {
      try {
        const engineType = engine.name === '네이버' ? 'naver' : 'google';
        
        // Report progress before starting
        onProgress?.({
          currentKeyword: kw.keyword,
          currentEngine: engine.name,
          processed,
          total: totalOperations,
          successful,
          failed,
        });
        
        const result = await scrapeKeyword(kw.keyword, engineType);

        if (result.success && result.results) {
          // Insert results
          const resultsToInsert = result.results.map((r) => ({
            job_id: job.id,
            keyword_id: kw.id,
            search_engine_id: engine.id,
            rank: r.rank,
            blog_title: r.title,
            blog_author: r.author,
            blog_url: r.url,
            snippet: r.snippet,
            published_date: r.published_date,
            blog_platform: r.platform,
            thumbnail_url: r.thumbnail_url,
          }));

          await supabase.from('crawl_results').insert(resultsToInsert);
          successful++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error('Error processing keyword:', e);
        failed++;
      }

      processed++;

      // Report progress after completion
      onProgress?.({
        currentKeyword: kw.keyword,
        currentEngine: engine.name,
        processed,
        total: totalOperations,
        successful,
        failed,
      });

      // Update job progress
      await supabase
        .from('crawl_jobs')
        .update({
          processed_keywords: processed,
          successful_keywords: successful,
          failed_keywords: failed,
        })
        .eq('id', job.id);

      // Rate limiting - wait between requests
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Complete the job
  await supabase
    .from('crawl_jobs')
    .update({
      status: failed === processed ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  return { success: true, jobId: job.id };
}