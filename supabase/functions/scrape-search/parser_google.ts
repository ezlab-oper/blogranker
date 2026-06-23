import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import {
  type BlogResult,
  detectBlogPlatform,
  extractAuthorFromUrl,
  isValidBlogPostUrl,
} from "./parser.ts";

const MAX_RESULTS = 10;
const DEFAULT_TITLE = '블로그 포스트';

// 구글 광고/지식패널/관련검색 등 비-organic 컨테이너 마커
const EXCLUDED_CLASS_RE =
  /(?:^|[\s"])(?:commercial-unit-desktop-top|commercial-unit|ads-ad|ads-fr|ad-side|kp-blk|knowledge-panel|related-question-pair)/i;


// 구글 검색 결과 1페이지 파서.
// 전략: a[href]에서 블로그 포스트 URL 추출(클래스 비의존). `/url?q=` 리다이렉트 해석 포함.
// 제목은 anchor 내부 h3 우선 → 없으면 anchor textContent.
//
// 블로그 도메인 화이트리스트·POST URL 패턴은 parser.ts의 isValidBlogPostUrl이 담당하므로
// google.com / youtube.com / maps 등은 자연스럽게 제외된다.

function isInExcludedSection(el: Element): boolean {
  let node: Element | null = el;
  let depth = 0;
  while (node && depth < 20) {
    const cls = node.getAttribute('class');
    if (cls && EXCLUDED_CLASS_RE.test(cls)) return true;
    // 스폰서드 광고: <div data-text-ad="1"> 또는 aria-label="Sponsored"
    if (node.getAttribute('data-text-ad') != null) return true;
    const aria = node.getAttribute('aria-label') || '';
    if (aria.toLowerCase().includes('sponsored')) return true;
    node = node.parentElement;
    depth++;
  }
  return false;
}

function cleanTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length < 5) return null;
  if (t.startsWith('http') || t.startsWith('www.')) return null;
  if (/^(검색|메뉴|로그인|블로그홈|이웃목록|더보기|광고)/.test(t)) return null;
  return t;
}

// 구글의 /url?q=ENCODED&... 리다이렉트에서 실제 URL을 복구
function resolveGoogleHref(href: string): string {
  if (!href) return '';
  // 절대(https://www.google.com/url?...) 또는 상대(/url?...) 모두 처리
  const idx = href.indexOf('/url?');
  if (idx === -1) return href;
  const qIdx = href.indexOf('q=', idx);
  if (qIdx === -1) return href;
  const rest = href.substring(qIdx + 2);
  const amp = rest.indexOf('&');
  const q = amp >= 0 ? rest.substring(0, amp) : rest;
  try {
    return decodeURIComponent(q);
  } catch {
    return q;
  }
}

export function parseGoogleResults(_markdown: string, rawHtml: string): BlogResult[] {
  const results: BlogResult[] = [];
  const addedUrls = new Set<string>();

  if (!rawHtml) return results;

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  if (!doc) {
    console.warn('DOMParser returned null document');
    return results;
  }

  const anchors = Array.from(doc.querySelectorAll('a[href]')) as unknown as Element[];

  for (const a of anchors) {
    if (results.length >= MAX_RESULTS) break;

    const raw = a.getAttribute('href') || '';
    const url = resolveGoogleHref(raw);
    if (!isValidBlogPostUrl(url)) continue;
    if (isInExcludedSection(a)) continue;

    // 제목 후보: anchor 내부 h3 → anchor 텍스트 → 부모 컨테이너 안 h3 (썸네일 anchor 대응)
    const h3 = a.querySelector('h3')
      || a.parentElement?.querySelector('h3')
      || a.parentElement?.parentElement?.querySelector('h3');
    const text = (h3?.textContent ?? a.textContent ?? '').toString();
    const nodeTitle = cleanTitle(text);

    if (addedUrls.has(url)) {
      // 이미 등록된 URL이 DEFAULT_TITLE이면 더 나은 텍스트로 교체.
      if (nodeTitle) {
        const existing = results.find((r) => r.url === url);
        if (existing && existing.title === DEFAULT_TITLE) existing.title = nodeTitle;
      }
      continue;
    }

    addedUrls.add(url);
    results.push({
      rank: results.length + 1,
      title: nodeTitle ?? DEFAULT_TITLE,
      author: extractAuthorFromUrl(url),
      url,
      snippet: null,
      published_date: null,
      platform: detectBlogPlatform(url),
      thumbnail_url: null,
    });
  }

  return results;
}
