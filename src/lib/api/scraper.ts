import { supabase } from '@/integrations/supabase/client';

// Utility function to generate random delay between min and max (in ms)
function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

// Abort controller for cancellation
let currentAbortController: AbortController | null = null;

export function cancelCrawlJob(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
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
  cancelled?: boolean;
}> {
  // Create new abort controller for this job
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

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

  // Randomize the order of engines to vary the request pattern
  const shuffledEngines = shuffleArray(engines);

  let processed = 0;
  let successful = 0;
  let failed = 0;
  const totalOperations = keywords.length * shuffledEngines.length;

  // Process each keyword for each engine
  for (const kw of keywords) {
    for (const engine of shuffledEngines) {
      // Check if cancelled
      if (signal.aborted) {
        // Update job status to cancelled
        await supabase
          .from('crawl_jobs')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        
        currentAbortController = null;
        return { success: false, cancelled: true, jobId: job.id };
      }

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
      // Randomize delay between 3-7 seconds to avoid pattern detection
      const delay = randomDelay(3000, 7000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    
    // Additional random delay between keywords (1-3 seconds)
    if (kw !== keywords[keywords.length - 1]) {
      const interKeywordDelay = randomDelay(1000, 3000);
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, interKeywordDelay);
        // Allow cancellation during delay
        if (signal.aborted) {
          clearTimeout(timeout);
          resolve(undefined);
        }
      });
    }
  }

  currentAbortController = null;

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