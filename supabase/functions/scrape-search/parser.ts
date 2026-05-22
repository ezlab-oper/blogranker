import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

export interface BlogResult {
  rank: number;
  title: string;
  author: string | null;
  url: string;
  snippet: string | null;
  published_date: string | null;
  platform: string | null;
  thumbnail_url: string | null;
}

const MAX_RESULTS = 10;
const DEFAULT_TITLE = '블로그 포스트';

// 블로그 도메인 및 게시물 URL 패턴
const BLOG_DOMAINS = ['blog.naver.com', 'm.blog.naver.com', 'tistory.com', 'velog.io', 'brunch.co.kr'];
const EXCLUDE_URL_PATTERNS = [
  'PostList.naver', 'BlogHome.naver', 'MyBlog.naver',
  'section.blog.naver.com', 'nid.naver.com', 'help.naver.com',
  'prologue', 'category=', 'Redirect=', '/blog_intro',
];
const POST_URL_PATTERNS = [
  /blog\.naver\.com\/[a-zA-Z0-9_-]+\/\d+/,
  /m\.blog\.naver\.com\/[a-zA-Z0-9_-]+\/\d+/,
  /blog\.naver\.com\/PostView\.(nhn|naver)\?/,
  /tistory\.com\/\d+/,
  /tistory\.com\/entry\//,
  /velog\.io\/@[^/]+\/[^/?]+/,
  /brunch\.co\.kr\/@[^/]+\/\d+/,
];

// AI 브리핑/광고/추천 등 제외 대상 섹션의 클래스 토큰
const EXCLUDED_CLASS_RE =
  /(?:^|[\s"])(?:api_ai_briefing|ai_briefing|ai_answer|sc_ai|cue_|cue\b|fuser_|fusion[-_]|api_subject_bx|lb_ad|link_ad|spw_rerank|main_pack_ad|power_link|ad_section)/i;

// 결과 컨테이너 셀렉터 (네이버 통합검색의 블로그 영역)
const CONTAINER_SELECTOR = 'li.bx, div.view_wrap, div.detail_box, li.blog, div.total_wrap';

// 제목 후보 앵커 셀렉터 (우선순위 순)
const TITLE_ANCHOR_SELECTOR =
  'a.title_link, a.api_txt_lines.total_tit, .total_tit a, .title_area a, a.title_area';

export function detectBlogPlatform(url: string): string | null {
  if (url.includes('blog.naver.com') || url.includes('m.blog.naver.com')) return '네이버블로그';
  if (url.includes('tistory.com')) return '티스토리';
  if (url.includes('velog.io')) return 'Velog';
  if (url.includes('brunch.co.kr')) return '브런치';
  if (url.includes('wordpress.com') || url.includes('wp.com')) return '워드프레스';
  if (url.includes('medium.com')) return 'Medium';
  return null;
}

export function extractAuthorFromUrl(url: string): string | null {
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

// 요소 또는 조상 노드가 제외 섹션(AI/광고)에 속하는지 검사
export function isInExcludedSection(el: Element): boolean {
  let node: Element | null = el;
  let depth = 0;
  while (node && depth < 20) {
    const cls = node.getAttribute('class');
    if (cls && EXCLUDED_CLASS_RE.test(cls)) return true;
    node = node.parentElement;
    depth++;
  }
  return false;
}

export function isValidBlogPostUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  if (!BLOG_DOMAINS.some((d) => url.includes(d))) return false;
  if (EXCLUDE_URL_PATTERNS.some((p) => url.includes(p))) return false;
  if (!POST_URL_PATTERNS.some((p) => p.test(url))) return false;
  return true;
}

function cleanTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length < 5) return null;
  if (t.startsWith('http') || t.startsWith('www.')) return null;
  if (/^(검색|메뉴|로그인|블로그홈|이웃목록|더보기)/.test(t)) return null;
  return t;
}

// 단일 컨테이너에서 대표 블로그 게시물 1건 추출
function extractFromContainer(container: Element): { url: string; title: string } | null {
  // 1) 제목 앵커 우선 탐색
  const titleAnchor = container.querySelector(TITLE_ANCHOR_SELECTOR);
  if (titleAnchor) {
    const href = titleAnchor.getAttribute('href') || '';
    if (isValidBlogPostUrl(href)) {
      return { url: href, title: cleanTitle(titleAnchor.textContent) ?? DEFAULT_TITLE };
    }
  }

  // 2) 컨테이너 내 모든 앵커를 순회하며 첫 유효 게시물 URL 채택
  const anchors = Array.from(container.querySelectorAll('a')) as unknown as Element[];
  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    if (!isValidBlogPostUrl(href)) continue;
    return { url: href, title: cleanTitle(a.textContent) ?? DEFAULT_TITLE };
  }

  return null;
}

// rawHtml을 DOM으로 파싱해 블로그 결과를 추출. markdown으로 제목 보강.
export function parseNaverIntegratedResults(markdown: string, rawHtml: string): BlogResult[] {
  const results: BlogResult[] = [];
  const addedUrls = new Set<string>();

  if (rawHtml) {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    if (doc) {
      const containers = Array.from(doc.querySelectorAll(CONTAINER_SELECTOR)) as unknown as Element[];

      for (const container of containers) {
        if (results.length >= MAX_RESULTS) break;
        if (isInExcludedSection(container)) continue;

        const extracted = extractFromContainer(container);
        if (!extracted) continue;
        if (addedUrls.has(extracted.url)) continue;

        addedUrls.add(extracted.url);
        results.push({
          rank: results.length + 1,
          title: extracted.title,
          author: extractAuthorFromUrl(extracted.url),
          url: extracted.url,
          snippet: null,
          published_date: null,
          platform: detectBlogPlatform(extracted.url),
          thumbnail_url: null,
        });
      }
    }
  }

  // markdown 링크에서 제목 보강 (DOM 추출 제목이 기본값일 때)
  if (markdown) {
    const urlToTitle = new Map<string, string>();
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(markdown)) !== null) {
      const title = cleanTitle(match[1]);
      const url = match[2].trim();
      if (title) urlToTitle.set(url, title);
    }
    for (const r of results) {
      if (r.title === DEFAULT_TITLE) {
        const better = urlToTitle.get(r.url);
        if (better) r.title = better;
      }
    }
  }

  return results;
}
