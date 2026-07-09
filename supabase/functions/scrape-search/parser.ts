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

export interface NaverParseResult {
  organic: BlogResult[];
  ai_briefing: BlogResult[];
}

const MAX_RESULTS = 10;
const DEFAULT_TITLE = '블로그 포스트';

// 수집 대상 블로그 도메인 (네이버블로그 + 티스토리만)
const BLOG_DOMAINS = ['blog.naver.com', 'm.blog.naver.com', 'tistory.com'];
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
];

// AI 브리핑/광고 등 제외 대상 섹션의 클래스 토큰.
// 주의: api_subject_bx / _fsolid_head / type_head 는 블로그 결과를 포함하므로 제외하지 않는다.
//       지식백과(terms.naver.com)는 블로그 포스트 URL이 아니므로 isValidBlogPostUrl 단계에서 자동 제외된다.
const EXCLUDED_CLASS_RE =
  /(?:^|[\s"])(?:api_ai_briefing|ai_briefing|ai_answer|sc_ai|fuser_|fusion[-_]|lb_ad|link_ad|spw_rerank|main_pack_ad|power_link|ad_section)/i;

// 블로그 포스트 링크가 담기는 후보 노드.
// 네이버는 <a href> 외에 <button data-url="..."> 형태로도 링크를 노출한다(SDS 디자인).
// 클래스명은 자주 바뀌므로 클래스가 아닌 href/data-url 속성 기준으로 추출한다.
const LINK_NODE_SELECTOR = 'a[href], [data-url]';

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

// AI 브리핑(SDS) 블록 앵커. 2026-07-09 실측: 브리핑 위젯 전체가 fds-aib-* 클래스로 감싸짐
// (fds-aib-header, fds-aib-expandable-container 등). 브리핑 없는 페이지엔 0건.
// ponytail: fds-aib 단일 앵커. 네이버가 마크업 재개편하면 실측으로 이 토큰만 갱신.
const AI_BRIEFING_CLASS_RE = /(?:^|[\s"])fds-aib/i;

export function isInAiBriefing(el: Element): boolean {
  let node: Element | null = el;
  let depth = 0;
  while (node && depth < 20) {
    const cls = node.getAttribute('class');
    if (cls && AI_BRIEFING_CLASS_RE.test(cls)) return true;
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

// markdown의 [title](url) 링크에서 url→title 맵 구성 (유효 블로그 포스트만)
function buildMarkdownTitleMap(markdown: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!markdown) return map;
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(markdown)) !== null) {
    const title = cleanTitle(m[1]);
    const url = m[2].trim();
    if (title && isValidBlogPostUrl(url) && !map.has(url)) map.set(url, title);
  }
  return map;
}

// rawHtml을 DOM으로 파싱해 블로그 결과를 추출.
// href / data-url 속성에서 블로그 포스트 URL을 문서 순서대로 수집한다(클래스 비의존).
// 제목은 노드 텍스트 → markdown → 기본값 순으로 보강한다.
export function parseNaverIntegratedResults(markdown: string, rawHtml: string): NaverParseResult {
  const organic: BlogResult[] = [];
  const aiBriefing: BlogResult[] = [];
  const organicUrls = new Set<string>();
  const briefingUrls = new Set<string>();
  const mdTitles = buildMarkdownTitleMap(markdown);

  if (!rawHtml) return { organic, ai_briefing: aiBriefing };

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  if (!doc) {
    console.warn('DOMParser returned null document');
    return { organic, ai_briefing: aiBriefing };
  }

  const nodes = Array.from(doc.querySelectorAll(LINK_NODE_SELECTOR)) as unknown as Element[];

  for (const node of nodes) {
    const url = node.getAttribute('href') || node.getAttribute('data-url') || '';
    if (!isValidBlogPostUrl(url)) continue;
    if (isInExcludedSection(node)) continue; // 광고/레거시 제외 섹션은 완전 배제

    const inBriefing = isInAiBriefing(node);
    const bucket = inBriefing ? aiBriefing : organic;
    const seen = inBriefing ? briefingUrls : organicUrls;

    // organic만 10건 상한 (브리핑은 소수라 미적용)
    if (!inBriefing && organic.length >= MAX_RESULTS) continue;

    const nodeTitle = cleanTitle(node.textContent);

    if (seen.has(url)) {
      // 이미 추가된 URL의 제목이 기본값이면 더 나은 텍스트로 교체
      if (nodeTitle) {
        const existing = bucket.find((r) => r.url === url);
        if (existing && existing.title === DEFAULT_TITLE) existing.title = nodeTitle;
      }
      continue;
    }

    seen.add(url);
    bucket.push({
      rank: bucket.length + 1,
      title: nodeTitle ?? mdTitles.get(url) ?? DEFAULT_TITLE,
      author: extractAuthorFromUrl(url),
      url,
      snippet: null,
      published_date: null,
      platform: detectBlogPlatform(url),
      thumbnail_url: null,
    });
  }

  // 기본 제목 최종 보강 (markdown) — 두 버킷 모두
  for (const r of [...organic, ...aiBriefing]) {
    if (r.title === DEFAULT_TITLE) {
      const better = mdTitles.get(r.url);
      if (better) r.title = better;
    }
  }

  return { organic, ai_briefing: aiBriefing };
}
