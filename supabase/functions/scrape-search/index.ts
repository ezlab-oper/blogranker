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
  // Naver blog: blog.naver.com/username/postid or PostView.nhn?blogId=username
  if (url.includes('blog.naver.com')) {
    // Pattern: blog.naver.com/username/postid
    const pathMatch = url.match(/blog\.naver\.com\/([a-zA-Z0-9_-]+)\/\d+/);
    if (pathMatch && pathMatch[1] !== 'PostView') return pathMatch[1];
    
    // Pattern: PostView.nhn?blogId=username or PostView.naver?blogId=username
    const paramMatch = url.match(/blogId=([a-zA-Z0-9_-]+)/);
    if (paramMatch) return paramMatch[1];
    
    // Mobile pattern: m.blog.naver.com/username/postid
    const mobileMatch = url.match(/m\.blog\.naver\.com\/([a-zA-Z0-9_-]+)\/\d+/);
    if (mobileMatch) return mobileMatch[1];
    
    return null;
  }
  
  // Velog: velog.io/@username/post-title
  if (url.includes('velog.io')) {
    const match = url.match(/velog\.io\/@([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  
  // Brunch: brunch.co.kr/@username/postid
  if (url.includes('brunch.co.kr')) {
    const match = url.match(/brunch\.co\.kr\/@([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  
  // Tistory: subdomain.tistory.com/postid
  if (url.includes('tistory.com')) {
    const match = url.match(/([a-zA-Z0-9_-]+)\.tistory\.com/);
    return match ? match[1] : null;
  }
  
  return null;
}


// Parse Google integrated search results - extract blog posts from main search page
function parseGoogleResults(markdown: string, links: string[] = []): BlogResult[] {
  const results: BlogResult[] = [];
  const addedUrls = new Set<string>();
  
  // Only collect top 10 results for highest visibility
  const MAX_RESULTS = 10;
  
  // Blog domains to detect in integrated search results (include mobile versions)
  const blogDomains = ['tistory.com', 'blog.naver.com', 'm.blog.naver.com', 'velog.io', 'brunch.co.kr', 'medium.com'];
  
  // URLs to explicitly exclude (Google internal URLs)
  const excludePatterns = [
    'google.com/search',
    'google.com/url',
    'google.co.kr/search',
    'accounts.google.com',
    'support.google.com',
    'maps.google.com',
    'translate.google.com',
    'webcache.googleusercontent.com',
    'youtube.com',
    'play.google.com',
  ];
  
  // First, extract links from the links array - these are ordered by appearance
  for (const url of links) {
    if (results.length >= MAX_RESULTS) break;
    
    // Skip Google internal URLs
    const isExcluded = excludePatterns.some(pattern => url.includes(pattern));
    if (isExcluded) continue;
    
    // Check if it's a blog URL
    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    if (!isBlogUrl) continue;
    
    // Validate it's an actual post URL (not category/home page)
    const isValidPost = 
      /tistory\.com\/\d+/.test(url) ||
      /tistory\.com\/entry\//.test(url) ||
      /blog\.naver\.com\/[a-zA-Z0-9_-]+\/\d+/.test(url) ||
      /m\.blog\.naver\.com\/[a-zA-Z0-9_-]+\/\d+/.test(url) ||
      /blog\.naver\.com\/PostView\.(nhn|naver)\?/.test(url) ||
      /velog\.io\/@[^/]+\/[^/?]+/.test(url) ||
      /brunch\.co\.kr\/@[^/]+\/\d+/.test(url) ||
      /medium\.com\/[^/]+\/[^/]+-[a-f0-9]+/.test(url);
    
    if (!isValidPost) continue;
    if (addedUrls.has(url)) continue;
    
    addedUrls.add(url);
    
    // Extract author from URL using helper function
    const author = extractAuthorFromUrl(url);
    
    results.push({
      rank: results.length + 1,
      title: `블로그 포스트`, // Will try to find title from markdown
      author,
      url,
      snippet: null,
      published_date: null,
      platform: detectBlogPlatform(url),
      thumbnail_url: null,
    });
  }
  
  // Try to match titles from markdown to URLs we found
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  const urlToTitle = new Map<string, string>();
  
  while ((match = linkPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    // Skip invalid titles
    if (!title || title.length < 5) continue;
    if (title.startsWith('http') || title.includes('검색') || title.includes('로그인')) continue;
    
    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    if (isBlogUrl && !urlToTitle.has(url)) {
      urlToTitle.set(url, title);
    }
  }
  
  // Update titles for results we found
  for (const result of results) {
    const title = urlToTitle.get(result.url);
    if (title) {
      result.title = title;
    }
  }
  
  return results;
}

// Extract URLs from Naver AI Briefing (Cue:) section in raw HTML
function extractAiBriefingUrls(html: string): Set<string> {
  const excludeUrls = new Set<string>();
  if (!html) return excludeUrls;

  // Match AI briefing sections by known class patterns
  // Common classes: api_ai_briefing, cue-section, fusion-app, sc_ai, ai_answer
  const aiSectionPatterns = [
    /class="[^"]*(?:api_ai_briefing|cue[-_]section|fusion[-_]app|sc_ai|ai_answer|ai_briefing|api_subject_bx)[^"]*"[\s\S]*?<\/(?:div|section)>/gi,
    /<div[^>]*data-[-\w]*="ai[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  ];

  for (const pattern of aiSectionPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      // Extract all href URLs from within the matched AI section
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

// Parse Naver integrated search results - extract blog posts from main search page
// Naver's integrated search shows blogs in specific sections (블로그, VIEW 영역 등)
function parseNaverIntegratedResults(markdown: string, links: string[] = [], rawHtml: string = ''): BlogResult[] {
  const results: BlogResult[] = [];
  const addedUrls = new Set<string>();
  
  // Only collect top 10 results for highest visibility in integrated search
  const MAX_RESULTS = 10;
  
  // Blog domains that appear in Naver integrated search (include mobile versions)
  const blogDomains = ['blog.naver.com', 'm.blog.naver.com', 'tistory.com', 'velog.io', 'brunch.co.kr'];
  
  // Navigation/utility URLs to exclude
  const excludePatterns = [
    'PostList.naver',
    'BlogHome.naver',
    'MyBlog.naver',
    'section.blog.naver.com',
    'nid.naver.com',
    'help.naver.com',
    'prologue',
    'category=',
    'Redirect=',
    '/blog_intro',
  ];
  
  // Build exclusion set from AI briefing sections
  const aiBriefingUrls = extractAiBriefingUrls(rawHtml);

  // First, extract blog links from the links array - ordered by appearance
  for (const url of links) {
    if (results.length >= MAX_RESULTS) break;

    // Skip URLs found in AI briefing sections
    if (aiBriefingUrls.has(url)) {
      console.log(`Skipping AI briefing URL: ${url}`);
      continue;
    }
    
    // Check if it's a blog URL
    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    if (!isBlogUrl) continue;
    
    // Skip utility/navigation pages
    const isExcluded = excludePatterns.some(pattern => url.includes(pattern));
    if (isExcluded) continue;
    
    // Must be an actual post URL with numeric ID
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
    
    // Extract author from URL using helper function
    const author = extractAuthorFromUrl(url);
    
    results.push({
      rank: results.length + 1,
      title: `블로그 포스트`, // Will try to find title from markdown
      author,
      url,
      snippet: null,
      published_date: null,
      platform: detectBlogPlatform(url),
      thumbnail_url: null,
    });
  }
  
  // Extract titles from markdown and match to URLs
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  const urlToTitle = new Map<string, string>();
  
  while ((match = linkPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    // Skip invalid titles
    if (!title || title.length < 5) continue;
    if (title.includes('검색') || title.includes('메뉴') || title.includes('로그인')) continue;
    if (title.includes('블로그홈') || title.includes('이웃목록') || title.includes('더보기')) continue;
    if (title.startsWith('http') || title.startsWith('www.')) continue;
    
    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    if (isBlogUrl && !urlToTitle.has(url)) {
      urlToTitle.set(url, title);
    }
  }
  
  // Update titles for results we found
  for (const result of results) {
    const title = urlToTitle.get(result.url);
    if (title) {
      result.title = title;
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

    // Build search URL based on engine - use INTEGRATED search (main search page)
    // IMPORTANT: Do NOT use specialized tabs like "view" or add site filters
    let searchUrl: string;
    if (engine === 'naver') {
      // Naver integrated search - main search page without 'where' parameter
      searchUrl = `https://search.naver.com/search.naver?ie=UTF-8&query=${encodeURIComponent(keyword)}&sm=chr_hty`;
    } else {
      // Google integrated search - main search without site filters
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&hl=ko&ie=UTF-8`;
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
        formats: ['markdown', 'links', 'rawHtml'],
        onlyMainContent: false,
        waitFor: 5000, // Wait longer for dynamic content
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

    // Parse results based on engine - use both markdown and links
    const markdown = data.data?.markdown || data.markdown || '';
    const links: string[] = data.data?.links || data.links || [];
    const rawHtml: string = data.data?.rawHtml || data.rawHtml || '';
    
    console.log(`Received ${links.length} links from Firecrawl`);
    
    let blogResults: BlogResult[];

    if (engine === 'naver') {
      blogResults = parseNaverIntegratedResults(markdown, links, rawHtml);
    } else {
      blogResults = parseGoogleResults(markdown, links);
    }

    console.log(`Found ${blogResults.length} blog results for ${engine} from integrated search`);

    return new Response(
      JSON.stringify({
        success: true,
        keyword,
        engine,
        results: blogResults,
        raw_markdown: markdown.substring(0, 3000), // Truncate for debugging
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