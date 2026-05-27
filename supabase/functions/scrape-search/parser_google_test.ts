// 실행: deno test --allow-net supabase/functions/scrape-search/parser_google_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGoogleResults } from "./parser_google.ts";

// 구글 검색 결과 1페이지를 모사한 픽스처
const FIXTURE = `
<html><body>
<div id="search">
  <div id="rso">
    <!-- 광고 영역(제외 대상) -->
    <div class="commercial-unit-desktop-top">
      <a href="https://blog.naver.com/adcorp/9999"><h3>광고 글</h3></a>
    </div>

    <!-- 일반 결과: 직접 href -->
    <div class="MjjYud">
      <a href="https://blog.naver.com/realuser/12345"><h3>맛집 추천 정리</h3></a>
    </div>

    <!-- 일반 결과: /url?q= 리다이렉트 -->
    <div class="MjjYud">
      <a href="/url?q=https://hong.tistory.com/entry/seoul-cafe&amp;sa=U&amp;ved=xyz">
        <h3>서울 카페 후기</h3>
      </a>
    </div>

    <!-- 일반 결과: velog -->
    <div class="MjjYud">
      <a href="https://velog.io/@devkim/nextjs-migration"><h3>Next.js 마이그레이션 회고</h3></a>
    </div>

    <!-- 지식패널(제외) -->
    <div class="kp-blk">
      <a href="https://blog.naver.com/wiki/777"><h3>위키 인용</h3></a>
    </div>

    <!-- 중복 -->
    <div class="MjjYud">
      <a href="https://blog.naver.com/realuser/12345"><h3>맛집 추천 정리(중복)</h3></a>
    </div>

    <!-- 비-블로그 도메인 (제외) -->
    <div class="MjjYud">
      <a href="https://www.youtube.com/watch?v=abc"><h3>유튜브 영상</h3></a>
    </div>
  </div>
</div>
</body></html>
`;

Deno.test("organic 블로그 결과만 추출하고 광고/지식패널/중복/비-블로그는 제외", () => {
  const results = parseGoogleResults("", FIXTURE);
  const urls = results.map((r) => r.url);

  assertEquals(results.length, 3);
  assertEquals(urls, [
    "https://blog.naver.com/realuser/12345",
    "https://hong.tistory.com/entry/seoul-cafe",
    "https://velog.io/@devkim/nextjs-migration",
  ]);
  assertEquals(urls.includes("https://blog.naver.com/adcorp/9999"), false);
  assertEquals(urls.includes("https://blog.naver.com/wiki/777"), false);
  assertEquals(results.map((r) => r.rank), [1, 2, 3]);
});

Deno.test("플랫폼/작성자/제목 추출", () => {
  const results = parseGoogleResults("", FIXTURE);
  assertEquals(results[0].platform, "네이버블로그");
  assertEquals(results[0].author, "realuser");
  assertEquals(results[0].title, "맛집 추천 정리");

  assertEquals(results[1].platform, "티스토리");
  assertEquals(results[1].author, "hong");
  assertEquals(results[1].title, "서울 카페 후기");

  assertEquals(results[2].platform, "Velog");
  assertEquals(results[2].author, "devkim");
});

Deno.test("/url?q= 리다이렉트가 디코드되어 실제 URL로 풀린다", () => {
  const html = `<a href="/url?q=https%3A%2F%2Fblog.naver.com%2Fuser%2F123&sa=U&ved=x"><h3>인코딩된 글</h3></a>`;
  const results = parseGoogleResults("", html);
  assertEquals(results.length, 1);
  assertEquals(results[0].url, "https://blog.naver.com/user/123");
});

Deno.test("sponsored aria-label도 제외", () => {
  const html = `
    <div aria-label="Sponsored">
      <a href="https://blog.naver.com/sponsor/1"><h3>스폰서 글</h3></a>
    </div>
    <div>
      <a href="https://blog.naver.com/normal/2"><h3>정상 글</h3></a>
    </div>`;
  const results = parseGoogleResults("", html);
  assertEquals(results.length, 1);
  assertEquals(results[0].url, "https://blog.naver.com/normal/2");
});

Deno.test("MAX_RESULTS(10)를 초과하지 않는다", () => {
  let html = '';
  for (let i = 1; i <= 15; i++) {
    html += `<a href="https://blog.naver.com/u${i}/${1000 + i}"><h3>글 ${i}</h3></a>`;
  }
  const results = parseGoogleResults("", html);
  assertEquals(results.length, 10);
});

Deno.test("h3 없으면 anchor textContent로 폴백", () => {
  const html = `<a href="https://blog.naver.com/user/55">제목만 있는 앵커</a>`;
  const results = parseGoogleResults("", html);
  assertEquals(results.length, 1);
  assertEquals(results[0].title, "제목만 있는 앵커");
});
