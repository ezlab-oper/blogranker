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

// Check if a container block belongs to an excluded section (AI briefing, ads, etc.)
function isExcludedSection(blockHtml: string): boolean {
  const excludePatterns = [
    /class="[^"]*(?:api_ai_briefing|cue[-_]section|fuser_section|fusion[-_]app|sc_ai|ai_answer|ai_briefing|api_subject_bx|sc_new\s+api_ai_answer|lb_ad)[^"]*"/i,
    /class="[^"]*cue[^"]*"/i,
  ];
  // Check the opening tags (first 500 chars) for excluded classes
  const head = blockHtml.substring(0, 500);
  return excludePatterns.some(p => p.test(head));
}

// Extract blog URLs from valid result containers in raw HTML
function extractBlogUrlsFromHtml(rawHtml: string): { url: string; title: string }[] {
  if (!rawHtml) return [];

  const results: { url: string; title: string }[] = [];
  const addedUrls = new Set<string>();
  const MAX_RESULTS = 10;

  const blogDomains = ['blog.naver.com', 'm.blog.naver.com', 'tistory.com', 'velog.io', 'brunch.co.kr'];
  const excludeUrlPatterns = [
    'PostList.naver', 'BlogHome.naver', 'MyBlog.naver',
    'section.blog.naver.com', 'nid.naver.com', 'help.naver.com',
    'prologue', 'category=', 'Redirect=', '/blog_intro',
  ];
  const postUrlPatterns = [
    /blog\.naver\.com\/[a-zA-Z0-9_-]+\/\d+/,
    /m\.blog\.naver\.com\/[a-zA-Z0-9_-]+\/\d+/,
    /blog\.naver\.com\/PostView\.(nhn|naver)\?/,
    /tistory\.com\/\d+/,
    /tistory\.com\/entry\//,
    /velog\.io\/@[^/]+\/[^/?]+/,
    /brunch\.co\.kr\/@[^/]+\/\d+/,
  ];

  // Find all result container blocks: <li class="bx ..."> or <div class="view_wrap ...">
  // We match opening tag + content greedily but limited
  const containerPattern = /<(?:li|div)\s+[^>]*class="[^"]*(?:(?<!\w)bx(?!\w)|view_wrap)[^"]*"[^>]*>[\s\S]*?<\/(?:li|div)>/gi;
  
  // Since greedy nested matching is hard with regex, use a simpler approach:
  // Split HTML by container boundaries and process each chunk
  const splitPattern = /(<(?:li|div)\s+[^>]*class="[^"]*(?:(?<!\w)bx(?!\w)|view_wrap)[^"]*"[^>]*>)/gi;
  const parts = rawHtml.split(splitPattern);

  for (let i = 1; i < parts.length; i += 2) {
    if (results.length >= MAX_RESULTS) break;

    const openingTag = parts[i];
    const content = parts[i + 1] || '';
    // Take a reasonable chunk (up to 5000 chars) as the block content
    const block = openingTag + content.substring(0, 5000);

    // Skip excluded sections (AI briefing, ads, etc.)
    if (isExcludedSection(block)) {
      console.log('Skipping excluded section (AI/Ad)');
      continue;
    }

    // Extract all href links from this block
    const hrefPattern = /href="(https?:\/\/[^"]+)"/g;
    let hrefMatch;
    while ((hrefMatch = hrefPattern.exec(block)) !== null) {
      if (results.length >= MAX_RESULTS) break;

      const url = hrefMatch[1];

      // Must be a blog domain
      if (!blogDomains.some(d => url.includes(d))) continue;
      // Must not be an excluded URL pattern
      if (excludeUrlPatterns.some(p => url.includes(p))) continue;
      // Must match a valid post URL pattern
      if (!postUrlPatterns.some(p => p.test(url))) continue;
      // No duplicates
      if (addedUrls.has(url)) continue;

      addedUrls.add(url);

      // Try to extract title from nearby anchor text
      // Look for title_link or api_txt_lines patterns near this URL
      let title = '블로그 포스트';
      const titlePattern = new RegExp(`<a[^>]*href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([^<]+)<`, 'i');
      const titleMatch = block.match(titlePattern);
      if (titleMatch && titleMatch[1].trim().length >= 5) {
        title = titleMatch[1].trim();
      }

      results.push({
        url,
        title,
      });
    }
  }

  return results;
}

// Parse Naver integrated search results using HTML-first approach
function parseNaverIntegratedResults(markdown: string, links: string[] = [], rawHtml: string = ''): BlogResult[] {
  // Primary: extract from HTML containers (.bx, .view_wrap) with AI/ad exclusion
  const htmlResults = extractBlogUrlsFromHtml(rawHtml);

  console.log(`Extracted ${htmlResults.length} blog URLs from HTML containers`);

  const results: BlogResult[] = htmlResults.map((r, i) => ({
    rank: i + 1,
    title: r.title,
    author: extractAuthorFromUrl(r.url),
    url: r.url,
    snippet: null,
    published_date: null,
    platform: detectBlogPlatform(r.url),
    thumbnail_url: null,
  }));

  // Enrich titles from markdown if still default
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
    urlToTitle.set(url, title);
  }

  for (const result of results) {
    if (result.title === '블로그 포스트') {
      const betterTitle = urlToTitle.get(result.url);
      if (betterTitle) result.title = betterTitle;
    }
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
