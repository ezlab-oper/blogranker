// 포스팅 URL에서 제목·발행일 메타 추출.
// 네이버 블로그·티스토리·기타 워드프레스 등 og 메타 우선, <title> 폴백.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

async function authorize(req: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cronSecretExpected = Deno.env.get('CRON_SECRET');
  const cronSecretProvided = req.headers.get('x-cron-secret') || '';
  if (cronSecretExpected && cronSecretProvided && cronSecretProvided === cronSecretExpected) return { ok: true };
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, status: 401, error: 'Missing credentials' };
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnon) return { ok: false, status: 500, error: 'Server misconfiguration' };
  const supa = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: 'Invalid token' };
  return { ok: true };
}

// HTML에서 meta·title 정규식 추출.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function pickMeta(html: string, propRegex: RegExp): string | null {
  const m = html.match(propRegex);
  return m ? decodeEntities(m[1]).trim() : null;
}

function extractTitle(html: string): string | null {
  // 1) og:title
  const og = pickMeta(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    ?? pickMeta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og) return og;
  // 2) twitter:title
  const tw = pickMeta(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
  if (tw) return tw;
  // 3) <title>
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return t ? decodeEntities(t[1]).trim() : null;
}

function extractPublishedAt(html: string): string | null {
  // 1) article:published_time
  const meta = pickMeta(html, /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i)
    ?? pickMeta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i);
  if (meta) {
    const d = new Date(meta);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // 2) JSON-LD datePublished
  const jsonLdMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (jsonLdMatch) {
    const d = new Date(jsonLdMatch[1]);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // 3) <time datetime="...">
  const time = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (time) {
    const d = new Date(time[1]);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

// 네이버 블로그: blog.naver.com/{bid}/{postId}는 frame 페이지. PostView.naver를 직접 호출하면 본문 HTML.
function naverPostViewUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname !== 'blog.naver.com' && u.hostname !== 'm.blog.naver.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const [bid, postId] = parts;
    if (!/^\d+$/.test(postId)) return null;
    return `https://blog.naver.com/PostView.naver?blogId=${bid}&logNo=${postId}`;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authorize(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ success: false, error: auth.error }),
      { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const url: string = (body.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 네이버 블로그는 PostView.naver를 시도하고 실패 시 원본도 fallback.
    const urlsToTry = [naverPostViewUrl(url), url].filter((u): u is string => !!u);
    let title: string | null = null;
    let publishedAt: string | null = null;
    let fetchedUrl: string | null = null;

    for (const u of urlsToTry) {
      try {
        const resp = await fetch(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.5',
          },
          redirect: 'follow',
        });
        if (!resp.ok) continue;
        const html = await resp.text();
        title = title ?? extractTitle(html);
        publishedAt = publishedAt ?? extractPublishedAt(html);
        fetchedUrl = u;
        if (title && publishedAt) break;
      } catch (e) {
        console.error('fetch error for', u, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      title,
      published_at: publishedAt,
      fetched_url: fetchedUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
