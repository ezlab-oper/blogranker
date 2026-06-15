// 매칭 유틸리티 — 시트 동기화(blog_urls) 제거 이후, postings + bloggers를 단일 소스로 사용.
// 파일명은 호환성을 위해 유지하되, 내부는 새 모델 기반.

import type { Posting } from './usePostings';
import type { Blogger } from './useBloggers';

// 이지랩 공식 블로그 (프로그램 무관 최우선)
export const OFFICIAL_BLOG_ID = 'ezlab_official';
export const OFFICIAL_BLOG_URL = 'https://blog.naver.com/ezlab_official';

export type MatchType = 'official_blog' | 'exact_url' | 'same_blog_id' | 'expired_blogger' | 'none';
// 라벨:
//   official_blog   : 공식블로그 (ezlab_official)
//   exact_url       : 협업 포스팅 (postings 테이블에 등록된 URL — 우리가 의뢰한 그 글)
//   same_blog_id    : 협업 블로거 (status='계약됨' 블로거의 다른 글)
//   expired_blogger : 계약만료 블로거 (과거 협업했던 블로거)
//   none            : 일반

// URL에서 블로거 ID 추출
export function extractBlogId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'blog.naver.com' || u.hostname === 'm.blog.naver.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || null;
    }
    if (u.hostname.endsWith('.tistory.com')) {
      return u.hostname.replace('.tistory.com', '');
    }
    if (u.hostname === 'velog.io') {
      const match = u.pathname.match(/^\/@([^/]+)/);
      return match ? match[1] : null;
    }
    return u.hostname;
  } catch {
    return null;
  }
}

// URL 정규화: m.blog.naver.com ↔ blog.naver.com 통합, 쿼리·해시 제거
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'm.blog.naver.com') u.hostname = 'blog.naver.com';
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

export interface Matchers {
  // 협업 포스팅 URL 집합 (postings 테이블 기반, 정규화 포함)
  postingUrlSet: Set<string>;
  // 협업 블로거(=계약됨)의 blog_id 집합
  bloggerBlogIds: Set<string>;
  // 계약만료 블로거의 blog_id 집합 (별도 표시용)
  expiredBloggerIds: Set<string>;
}

export function buildMatchers(postings: Posting[], bloggers: Blogger[]): Matchers {
  const postingUrlSet = new Set<string>();
  for (const p of postings) {
    postingUrlSet.add(p.posting_url);
    postingUrlSet.add(normalizeUrl(p.posting_url));
  }
  const bloggerBlogIds = new Set<string>();
  const expiredBloggerIds = new Set<string>();
  for (const b of bloggers) {
    if (!b.blog_id) continue;
    if (b.status === '계약됨') bloggerBlogIds.add(b.blog_id);
    else if (b.status === '계약만료') expiredBloggerIds.add(b.blog_id);
  }
  return { postingUrlSet, bloggerBlogIds, expiredBloggerIds };
}

// 결과 URL의 매칭 등급 판정. 우선순위:
// official_blog > exact_url > same_blog_id(계약됨) > expired_blogger(계약만료) > none.
export function getMatchType(resultUrl: string, matchers: Matchers): MatchType {
  const blogId = extractBlogId(resultUrl);

  if (blogId === OFFICIAL_BLOG_ID) return 'official_blog';

  if (matchers.postingUrlSet.has(resultUrl) || matchers.postingUrlSet.has(normalizeUrl(resultUrl))) {
    return 'exact_url';
  }

  if (blogId && matchers.bloggerBlogIds.has(blogId)) return 'same_blog_id';
  if (blogId && matchers.expiredBloggerIds.has(blogId)) return 'expired_blogger';

  return 'none';
}
