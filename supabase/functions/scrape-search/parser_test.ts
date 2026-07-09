// 실행: deno test supabase/functions/scrape-search/parser_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseNaverIntegratedResults,
  detectBlogPlatform,
  extractAuthorFromUrl,
  isValidBlogPostUrl,
} from "./parser.ts";

// 네이버 통합검색 블로그 영역을 모사한 픽스처.
// - 정상 블로그 게시물 3건 (네이버블로그/티스토리/Velog)
// - AI 브리핑 섹션(api_ai_briefing) 내부의 블로그 링크 → 제외 대상
// - 광고 컨테이너(lb_ad) → 제외 대상
// - 동일 URL 중복 → 1건만
// - 블로그홈/카테고리 등 비게시물 URL → 제외
const FIXTURE_HTML = `
<html><body>
  <section class="api_ai_briefing">
    <li class="bx">
      <a class="title_link" href="https://blog.naver.com/aibot/99999">AI 브리핑이 인용한 글(제외돼야 함)</a>
    </li>
  </section>

  <div class="lb_ad">
    <li class="bx">
      <a class="title_link" href="https://blog.naver.com/adcorp/11111">광고 글(제외돼야 함)</a>
    </li>
  </div>

  <ul class="lst_total">
    <li class="bx">
      <a class="thumb" href="https://blog.naver.com/realuser/123456"><img src="x.jpg"/></a>
      <a class="title_link" href="https://blog.naver.com/realuser/123456">맛집 추천 정리글</a>
      <a class="sub_txt" href="https://blog.naver.com/realuser?Redirect=Log">realuser</a>
    </li>
    <li class="bx">
      <a class="title_link" href="https://hong.tistory.com/entry/seoul-cafe">서울 카페 후기</a>
    </li>
    <li class="bx">
      <a class="title_link" href="https://velog.io/@devkim/nextjs-migration">Next.js 마이그레이션 회고</a>
    </li>
    <!-- 중복 URL -->
    <li class="bx">
      <a class="title_link" href="https://blog.naver.com/realuser/123456">맛집 추천 정리글(중복)</a>
    </li>
    <!-- 비게시물(블로그홈) URL → 제외 -->
    <li class="bx">
      <a class="title_link" href="https://section.blog.naver.com/BlogHome.naver">블로그홈</a>
    </li>
  </ul>
</body></html>
`;

Deno.test("정상 게시물만 추출하고 AI/광고/중복/비게시물은 제외한다", () => {
  const { organic: results } = parseNaverIntegratedResults("", FIXTURE_HTML);

  // 네이버블로그 + 티스토리만 통과 (velog는 도메인 화이트리스트에 없어 제외)
  assertEquals(results.length, 2);

  const urls = results.map((r) => r.url);
  assertEquals(urls, [
    "https://blog.naver.com/realuser/123456",
    "https://hong.tistory.com/entry/seoul-cafe",
  ]);

  // AI/광고/velog 모두 제외
  assertEquals(urls.includes("https://blog.naver.com/aibot/99999"), false);
  assertEquals(urls.includes("https://blog.naver.com/adcorp/11111"), false);
  assertEquals(urls.includes("https://velog.io/@devkim/nextjs-migration"), false);

  // rank는 1부터 순차
  assertEquals(results.map((r) => r.rank), [1, 2]);
});

Deno.test("data-url 속성(SDS 버튼)에서도 추출한다", () => {
  // 네이버 신형 마크업: <button data-url="...post"> 형태
  const html = `
    <div>
      <button class="sds-comps-button" data-url="https://blog.naver.com/userone/111222">옵션</button>
      <a href="https://blog.naver.com/userone/111222">userone 블로그 글 제목</a>
      <button class="sds-comps-button" data-url="https://blog.naver.com/usertwo/333444">옵션</button>
    </div>`;
  const { organic: results } = parseNaverIntegratedResults("", html);
  assertEquals(results.length, 2);
  assertEquals(results[0].url, "https://blog.naver.com/userone/111222");
  // a 태그 텍스트로 제목 보강
  assertEquals(results[0].title, "userone 블로그 글 제목");
  assertEquals(results[1].url, "https://blog.naver.com/usertwo/333444");
  assertEquals(results[1].author, "usertwo");
});

Deno.test("플랫폼/작성자/제목을 올바르게 추출한다", () => {
  const { organic: results } = parseNaverIntegratedResults("", FIXTURE_HTML);

  assertEquals(results[0].platform, "네이버블로그");
  assertEquals(results[0].author, "realuser");
  assertEquals(results[0].title, "맛집 추천 정리글");

  assertEquals(results[1].platform, "티스토리");
  assertEquals(results[1].author, "hong");
});

Deno.test("markdown으로 기본 제목을 보강한다", () => {
  // 제목 앵커 텍스트가 비어 기본값이 되는 경우
  const html = `<li class="bx"><a class="title_link" href="https://blog.naver.com/u/777"></a></li>`;
  const md = `[마크다운에서 가져온 제목](https://blog.naver.com/u/777)`;
  const { organic: results } = parseNaverIntegratedResults(md, html);
  assertEquals(results.length, 1);
  assertEquals(results[0].title, "마크다운에서 가져온 제목");
});

Deno.test("MAX_RESULTS(10)를 초과하지 않는다", () => {
  let html = '<ul>';
  for (let i = 1; i <= 15; i++) {
    html += `<li class="bx"><a class="title_link" href="https://blog.naver.com/user/${1000 + i}">글 번호 ${i}</a></li>`;
  }
  html += '</ul>';
  const { organic: results } = parseNaverIntegratedResults("", html);
  assertEquals(results.length, 10);
});

Deno.test("isValidBlogPostUrl 경계 케이스", () => {
  assertEquals(isValidBlogPostUrl("https://blog.naver.com/u/123"), true);
  assertEquals(isValidBlogPostUrl("https://section.blog.naver.com/BlogHome.naver"), false);
  assertEquals(isValidBlogPostUrl("https://google.com/search"), false);
  assertEquals(isValidBlogPostUrl("not-a-url"), false);
});

Deno.test("detectBlogPlatform 매핑", () => {
  assertEquals(detectBlogPlatform("https://blog.naver.com/x/1"), "네이버블로그");
  assertEquals(detectBlogPlatform("https://x.tistory.com/1"), "티스토리");
  assertEquals(detectBlogPlatform("https://example.com"), null);
});

Deno.test("extractAuthorFromUrl 매핑", () => {
  assertEquals(extractAuthorFromUrl("https://blog.naver.com/myid/123"), "myid");
  assertEquals(extractAuthorFromUrl("https://velog.io/@kim/post"), "kim");
  assertEquals(extractAuthorFromUrl("https://hong.tistory.com/5"), "hong");
});

Deno.test("AI 브리핑(fds-aib) 블로그는 ai_briefing으로 분리되고 organic 순위에서 빠진다", () => {
  const html = `
    <div class="main_pack">
      <div class="sc_new">
        <div class="api_subject_bx fds-aib-expandable-container">
          <div class="fds-aib-header">AI 브리핑</div>
          <a href="https://blog.naver.com/aibot/111">브리핑 인용글1</a>
          <a href="https://blog.naver.com/shared/222">공존 케이스</a>
        </div>
      </div>
      <ul class="lst_total">
        <li class="bx"><a href="https://blog.naver.com/realuser/333">일반 1위</a></li>
        <li class="bx"><a href="https://blog.naver.com/shared/222">공존 케이스(유기적)</a></li>
      </ul>
    </div>`;
  const { organic, ai_briefing } = parseNaverIntegratedResults("", html);

  assertEquals(ai_briefing.map((r) => r.url), [
    "https://blog.naver.com/aibot/111",
    "https://blog.naver.com/shared/222",
  ]);
  // 누수 해소: organic 최상위는 브리핑이 아닌 realuser
  assertEquals(organic[0].url, "https://blog.naver.com/realuser/333");
  assertEquals(organic[0].rank, 1);
  // 공존: shared/222는 organic에도 존재
  assertEquals(organic.some((r) => r.url === "https://blog.naver.com/shared/222"), true);
  // 브리핑 인용글은 organic에 없음
  assertEquals(organic.some((r) => r.url === "https://blog.naver.com/aibot/111"), false);
});
