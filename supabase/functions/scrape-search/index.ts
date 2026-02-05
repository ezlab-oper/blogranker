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

// Parse Naver blog search results from markdown
// Naver blog search page has a different structure than the main search
function parseNaverResults(markdown: string, links: string[] = []): BlogResult[] {
  const results: BlogResult[] = [];
  let rank = 1;
  
  // Strategy 1: Extract from links array (more reliable)
  // Naver blog URLs follow pattern: blog.naver.com/PostView.naver or blog.naver.com/username/postid
  const blogLinks = links.filter(link => 
    link.includes('blog.naver.com') && 
    (link.includes('/PostView') || /blog\.naver\.com\/[^/]+\/\d+/.test(link))
  );
  
  for (const url of blogLinks) {
    if (rank > 30) break;
    
    // Try to extract author from URL (blog.naver.com/username)
    const authorMatch = url.match(/blog\.naver\.com\/([^/?]+)/);
    const author = authorMatch ? authorMatch[1] : null;
    
    results.push({
      rank: rank++,
      title: `네이버 블로그 포스트 #${rank - 1}`,
      author,
      url,
      snippet: null,
      published_date: null,
      platform: '네이버블로그',
      thumbnail_url: null,
    });
  }
  
  // Strategy 2: Parse markdown content for blog entries
  // Look for patterns like [title](blog.naver.com/...) or title links
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/blog\.naver\.com[^)]+)\)/g;
  let match;
  
  while ((match = linkPattern.exec(markdown)) !== null && results.length < 30) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    // Skip if already added or if it's not a post URL
    if (results.some(r => r.url === url)) continue;
    if (!url.includes('/PostView') && !/blog\.naver\.com\/[^/]+\/\d+/.test(url)) continue;
    
    // Extract author from URL
    const authorMatch = url.match(/blog\.naver\.com\/([^/?]+)/);
    const author = authorMatch ? authorMatch[1] : null;
    
    results.push({
      rank: results.length + 1,
      title: title || `네이버 블로그 포스트`,
      author,
      url,
      snippet: null,
      published_date: null,
      platform: '네이버블로그',
      thumbnail_url: null,
    });
  }
  
  // Strategy 3: Also check for other blog platforms in Naver search
  const otherBlogPattern = /\[([^\]]+)\]\((https?:\/\/(?:[^)]*(?:tistory\.com|velog\.io|brunch\.co\.kr)[^)]+))\)/g;
  
  while ((match = otherBlogPattern.exec(markdown)) !== null && results.length < 30) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    if (!results.some(r => r.url === url)) {
      results.push({
        rank: results.length + 1,
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
  
  // Re-rank results
  results.forEach((r, i) => r.rank = i + 1);
  
  return results;
}

// Parse Google search results from markdown
function parseGoogleResults(markdown: string, links: string[] = []): BlogResult[] {
  const results: BlogResult[] = [];
  const addedUrls = new Set<string>();
  const urlToTitle = new Map<string, string>();
  
  // Only collect top 10 results from first page for highest visibility
  const MAX_RESULTS = 10;
  
  const blogDomains = ['tistory.com', 'blog.naver.com', 'velog.io', 'brunch.co.kr', 'medium.com', 'wordpress.com'];
  
  // Parse markdown for blog links with ACTUAL titles only
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    // Skip invalid titles (too short, navigation elements, or placeholder-like)
    if (!title || title.length < 5) continue;
    if (title.includes('검색') || title.includes('메뉴') || title.includes('로그인')) continue;
    if (title.startsWith('블로그 포스트') || title.startsWith('#')) continue;
    
    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    
    if (isBlogUrl && !urlToTitle.has(url)) {
      urlToTitle.set(url, title);
    }
  }
  
  // Only add results with actual titles
  for (const [url, title] of urlToTitle) {
    if (results.length >= MAX_RESULTS) break;
    if (addedUrls.has(url)) continue;
    
    addedUrls.add(url);
    results.push({
      rank: results.length + 1,
      title,
      author: null,
      url,
      snippet: null,
      published_date: null,
      platform: detectBlogPlatform(url),
      thumbnail_url: null,
    });
  }
  
  // Re-rank results
  results.forEach((r, i) => r.rank = i + 1);
  
  return results;
}

// Alternative parser for Naver VIEW tab (blog search)
function parseNaverViewResults(markdown: string, links: string[] = []): BlogResult[] {
  const results: BlogResult[] = [];
  const addedUrls = new Set<string>();
  const urlToTitle = new Map<string, string>();
  
  // Only collect top 10 results from first page for highest visibility
  const MAX_RESULTS = 10;
  
  const blogDomains = ['blog.naver.com', 'tistory.com', 'velog.io', 'brunch.co.kr'];
  
  // Extract titles from markdown - ONLY collect items with actual titles
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const url = match[2].trim();
    
    // Skip invalid titles
    if (!title || title.length < 5) continue;
    if (title.includes('검색') || title.includes('메뉴') || title.includes('로그인')) continue;
    if (title.includes('블로그홈') || title.includes('이웃목록')) continue;
    if (title.startsWith('블로그 포스트') || title.startsWith('#')) continue;
    
    const isBlogUrl = blogDomains.some(domain => url.includes(domain));
    
    // Skip navigation/utility URLs
    const isUtilityUrl = url.includes('PostList') || 
                         url.includes('BlogHome') || 
                         url.includes('prologue') ||
                         url.includes('category') ||
                         url.includes('?Redirect') ||
                         url.includes('nid.naver.com') ||
                         url.includes('MyBlog.naver') ||
                         url.includes('section.blog.naver.com');
    
    // Must be a post URL (contains numeric ID)
    const isPostUrl = /blog\.naver\.com\/[^/]+\/\d+/.test(url) || 
                      /tistory\.com\/\d+/.test(url) ||
                      url.includes('velog.io/@') ||
                      url.includes('brunch.co.kr/@');
    
    if (isBlogUrl && !isUtilityUrl && isPostUrl && !urlToTitle.has(url)) {
      urlToTitle.set(url, title);
    }
  }
  
  // Only add results with actual titles
  for (const [url, title] of urlToTitle) {
    if (results.length >= MAX_RESULTS) break;
    if (addedUrls.has(url)) continue;
    
    addedUrls.add(url);
    
    // Extract author from Naver blog URL
    let author: string | null = null;
    if (url.includes('blog.naver.com')) {
      const authorMatch = url.match(/blog\.naver\.com\/([^/?]+)/);
      author = authorMatch ? authorMatch[1] : null;
    }
    
    results.push({
      rank: results.length + 1,
      title,
      author,
      url,
      snippet: null,
      published_date: null,
      platform: detectBlogPlatform(url),
      thumbnail_url: null,
    });
  }
  
  // Re-rank results
  results.forEach((r, i) => r.rank = i + 1);
  
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

    // Build search URL based on engine - use blog-specific search for Naver
    let searchUrl: string;
    if (engine === 'naver') {
      // Use Naver's VIEW tab (blog search) for better blog results
      searchUrl = `https://search.naver.com/search.naver?where=view&query=${encodeURIComponent(keyword)}`;
    } else {
      // Google search - only first page results (num=10) for highest visibility content
      searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}+site:tistory.com+OR+site:blog.naver.com+OR+site:velog.io&hl=ko&num=10`;
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
    
    console.log(`Received ${links.length} links from Firecrawl`);
    
    let blogResults: BlogResult[];

    if (engine === 'naver') {
      blogResults = parseNaverViewResults(markdown, links);
    } else {
      blogResults = parseGoogleResults(markdown, links);
    }

    console.log(`Found ${blogResults.length} blog results for ${engine}`);

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