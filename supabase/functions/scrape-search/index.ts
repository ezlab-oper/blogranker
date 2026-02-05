const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScrapeRequest {
  keyword: string;
  engine: 'naver' | 'google';
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

// Detect blog platform from URL
function detectBlogPlatform(url: string): string | null {
  if (url.includes('blog.naver.com')) return '네이버블로그';
  if (url.includes('tistory.com')) return '티스토리';
  if (url.includes('velog.io')) return 'Velog';
  if (url.includes('brunch.co.kr')) return '브런치';
  if (url.includes('wordpress.com') || url.includes('wp.com')) return '워드프레스';
  if (url.includes('medium.com')) return 'Medium';
  return null;
}

// Parse Naver search results from markdown
function parseNaverResults(markdown: string): BlogResult[] {
  const results: BlogResult[] = [];
  
  // Naver blog section pattern - look for blog entries
  const blogSectionMatch = markdown.match(/## 블로그([\s\S]*?)(?=##|$)/i);
  if (!blogSectionMatch) {
    console.log('No blog section found in Naver results');
    return results;
  }
  
  const blogSection = blogSectionMatch[1];
  
  // Parse individual blog entries - typically formatted as links with titles
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  let rank = 1;
  
  while ((match = linkPattern.exec(blogSection)) !== null && rank <= 10) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    // Filter for actual blog URLs
    if (url.includes('blog.naver.com') || 
        url.includes('tistory.com') || 
        url.includes('velog.io') ||
        url.includes('brunch.co.kr')) {
      
      results.push({
        rank: rank++,
        title,
        author: null, // Will try to extract from context
        url,
        snippet: null,
        published_date: null,
        platform: detectBlogPlatform(url),
        thumbnail_url: null,
      });
    }
  }
  
  return results;
}

// Parse Google search results from markdown
function parseGoogleResults(markdown: string): BlogResult[] {
  const results: BlogResult[] = [];
  
  // Google results pattern - look for links to blog domains
  const blogDomains = ['tistory.com', 'blog.naver.com', 'velog.io', 'brunch.co.kr', 'medium.com', 'wordpress.com'];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  let rank = 1;
  
  while ((match = linkPattern.exec(markdown)) !== null && rank <= 30) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    // Check if URL is from a blog domain
    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    
    if (isBlogUrl) {
      results.push({
        rank: rank++,
        title,
        author: null,
        url,
        snippet: null,
        published_date: null,
        platform: detectBlogPlatform(url),
        thumbnail_url: null,
      });
    }
  }
  
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyword, engine }: ScrapeRequest = await req.json();

    if (!keyword || !engine) {
      return new Response(
        JSON.stringify({ success: false, error: 'Keyword and engine are required' }),
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

    // Build search URL based on engine
    let searchUrl: string;
    if (engine === 'naver') {
      searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;
    } else {
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&hl=ko`;
    }

    console.log(`Scraping ${engine} for keyword: ${keyword}`);
    console.log(`URL: ${searchUrl}`);

    // Call Firecrawl scrape API
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown', 'links'],
        onlyMainContent: false,
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Firecrawl request failed` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse results based on engine
    const markdown = data.data?.markdown || data.markdown || '';
    let blogResults: BlogResult[];

    if (engine === 'naver') {
      blogResults = parseNaverResults(markdown);
    } else {
      blogResults = parseGoogleResults(markdown);
    }

    console.log(`Found ${blogResults.length} blog results for ${engine}`);

    return new Response(
      JSON.stringify({
        success: true,
        keyword,
        engine,
        results: blogResults,
        raw_markdown: markdown.substring(0, 5000), // Truncate for debugging
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