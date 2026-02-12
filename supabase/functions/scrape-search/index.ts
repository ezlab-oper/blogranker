const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScrapeRequest {
  keyword: string;
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
  if (url.includes('blog.naver.com') || url.includes('m.blog.naver.com')) return '네이버블로그';
  if (url.includes('tistory.com')) return '티스토리';
  if (url.includes('velog.io')) return 'Velog';
  if (url.includes('brunch.co.kr')) return '브런치';
  if (url.includes('wordpress.com') || url.includes('wp.com')) return '워드프레스';
  if (url.includes('medium.com')) return 'Medium';
  return null;
}

// Extract author from blog URL
function extractAuthorFromUrl(url: string): string | null {
  if (url.includes('blog.naver.com')) {
    const pathMatch = url.match(/blog\.naver\.com\/([a-zA-Z0-9_-]+)\/\d+/);
    if (pathMatch && pathMatch[1] !== 'PostView') return pathMatch[1];
    const paramMatch = url.match(/blogId=([a-zA-Z0-9_-]+)/);
    if (paramMatch) return paramMatch[1];
    const mobileMatch = url.match(/m\.blog\.naver\.com\/([a-zA-Z0-9_-]+)\/\d+/);
    if (mobileMatch) return mobileMatch[1];
    return null;
  }
  if (url.includes('velog.io')) {
    const match = url.match(/velog\.io\/@([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  if (url.includes('brunch.co.kr')) {
    const match = url.match(/brunch\.co\.kr\/@([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  if (url.includes('tistory.com')) {
    const match = url.match(/([a-zA-Z0-9_-]+)\.tistory\.com/);
    return match ? match[1] : null;
  }
  return null;
}

// Extract URLs from Naver AI Briefing (Cue:) section in raw HTML
function extractAiBriefingUrls(html: string): Set<string> {
  const excludeUrls = new Set<string>();
  if (!html) return excludeUrls;

  // Match AI briefing sections by known class patterns
  const aiSectionPatterns = [
    /class="[^"]*(?:api_ai_briefing|cue[-_]section|fusion[-_]app|sc_ai|ai_answer|ai_briefing|api_subject_bx|sc_new\s+api_ai_answer)[^"]*"[\s\S]*?<\/(?:div|section)>/gi,
    /<div[^>]*data-[-\w]*="ai[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    // Broader: any element with "cue" in class
    /class="[^"]*cue[^"]*"[\s\S]*?<\/(?:div|section)>/gi,
  ];

  for (const pattern of aiSectionPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const hrefPattern = /href="(https?:\/\/[^"]+)"/g;
      let hrefMatch;
      while ((hrefMatch = hrefPattern.exec(match[0])) !== null) {
        excludeUrls.add(hrefMatch[1]);
      }
    }
  }

  console.log(`Found ${excludeUrls.size} URLs in AI briefing sections to exclude`);
  return excludeUrls;
}

// Parse Naver integrated search results - only from valid blog list sections
function parseNaverIntegratedResults(markdown: string, links: string[] = [], rawHtml: string = ''): BlogResult[] {
  const results: BlogResult[] = [];
  const addedUrls = new Set<string>();
  const MAX_RESULTS = 10;

  const blogDomains = ['blog.naver.com', 'm.blog.naver.com', 'tistory.com', 'velog.io', 'brunch.co.kr'];

  const excludePatterns = [
    'PostList.naver', 'BlogHome.naver', 'MyBlog.naver',
    'section.blog.naver.com', 'nid.naver.com', 'help.naver.com',
    'prologue', 'category=', 'Redirect=', '/blog_intro',
  ];

  // Build exclusion set from AI briefing sections
  const aiBriefingUrls = extractAiBriefingUrls(rawHtml);

  for (const url of links) {
    if (results.length >= MAX_RESULTS) break;

    // Skip URLs found in AI briefing sections
    if (aiBriefingUrls.has(url)) {
      console.log(`Skipping AI briefing URL: ${url}`);
      continue;
    }

    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    if (!isBlogUrl) continue;

    const isExcluded = excludePatterns.some(pattern => url.includes(pattern));
    if (isExcluded) continue;

    const isValidPost =
      /blog\.naver\.com\/[a-zA-Z0-9_-]+\/\d+/.test(url) ||
      /m\.blog\.naver\.com\/[a-zA-Z0-9_-]+\/\d+/.test(url) ||
      /blog\.naver\.com\/PostView\.(nhn|naver)\?/.test(url) ||
      /tistory\.com\/\d+/.test(url) ||
      /tistory\.com\/entry\//.test(url) ||
      /velog\.io\/@[^/]+\/[^/?]+/.test(url) ||
      /brunch\.co\.kr\/@[^/]+\/\d+/.test(url);

    if (!isValidPost) continue;
    if (addedUrls.has(url)) continue;

    addedUrls.add(url);

    results.push({
      rank: results.length + 1,
      title: '블로그 포스트',
      author: extractAuthorFromUrl(url),
      url,
      snippet: null,
      published_date: null,
      platform: detectBlogPlatform(url),
      thumbnail_url: null,
    });
  }

  // Extract titles from markdown
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  const urlToTitle = new Map<string, string>();

  while ((match = linkPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    if (!title || title.length < 5) continue;
    if (title.includes('검색') || title.includes('메뉴') || title.includes('로그인')) continue;
    if (title.includes('블로그홈') || title.includes('이웃목록') || title.includes('더보기')) continue;
    if (title.startsWith('http') || title.startsWith('www.')) continue;

    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    if (isBlogUrl && !urlToTitle.has(url)) {
      urlToTitle.set(url, title);
    }
  }

  for (const result of results) {
    const title = urlToTitle.get(result.url);
    if (title) result.title = title;
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const keyword: string = body.keyword;

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

    // Naver integrated search only
    const searchUrl = `https://search.naver.com/search.naver?ie=UTF-8&query=${encodeURIComponent(keyword)}&sm=chr_hty`;

    console.log(`Scraping naver for keyword: ${keyword}`);
    console.log(`URL: ${searchUrl}`);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['markdown', 'links', 'rawHtml'],
        onlyMainContent: false,
        waitFor: 5000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Firecrawl request failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = data.data?.markdown || data.markdown || '';
    const links: string[] = data.data?.links || data.links || [];
    const rawHtml: string = data.data?.rawHtml || data.rawHtml || '';

    console.log(`Received ${links.length} links from Firecrawl`);

    const blogResults = parseNaverIntegratedResults(markdown, links, rawHtml);

    console.log(`Found ${blogResults.length} blog results from integrated search`);

    return new Response(
      JSON.stringify({
        success: true,
        keyword,
        engine: 'naver',
        results: blogResults,
        raw_markdown: markdown.substring(0, 3000),
        links_count: links.length,
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
