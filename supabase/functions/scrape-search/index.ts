import { parseNaverIntegratedResults } from "./parser.ts";
import { parseGoogleResults } from "./parser_google.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const keyword: string = body.keyword;
    const engine: 'naver' | 'google' = body.engine === 'google' ? 'google' : 'naver';

    if (!keyword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Keyword is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 엔진별 검색 URL (1페이지만)
    const searchUrl = engine === 'google'
      ? `https://www.google.com/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=kr&num=10`
      : `https://search.naver.com/search.naver?ie=UTF-8&query=${encodeURIComponent(keyword)}&sm=chr_hty`;

    console.log(`Scraping ${engine} for keyword: ${keyword}`);

    // Firecrawl 요청. 구글은 봇 탐지가 강해 location(KR) + mobile UA를 추가한다.
    const firecrawlBody: Record<string, unknown> = {
      url: searchUrl,
      formats: ['markdown', 'rawHtml'],
      onlyMainContent: false,
      waitFor: 5000,
    };
    if (engine === 'google') {
      firecrawlBody.location = { country: 'KR', languages: ['ko-KR'] };
      firecrawlBody.mobile = true;
    }

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(firecrawlBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Firecrawl request failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown: string = data.data?.markdown || data.markdown || '';
    const rawHtml: string = data.data?.rawHtml || data.rawHtml || '';

    const blogResults = engine === 'google'
      ? parseGoogleResults(markdown, rawHtml)
      : parseNaverIntegratedResults(markdown, rawHtml);

    console.log(`Found ${blogResults.length} blog results (${engine})`);

    return new Response(
      JSON.stringify({
        success: true,
        keyword,
        engine,
        results: blogResults,
        raw_markdown: markdown.substring(0, 3000),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
