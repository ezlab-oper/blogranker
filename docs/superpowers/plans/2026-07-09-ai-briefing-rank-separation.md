# AI 브리핑 블로그 순위 분리 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네이버 AI 브리핑(`fds-aib`) 영역의 블로그를 순위(organic rank)에서 분리해 별도 수집·표시하고, 순위 추이에 브리핑 노출을 별도로 추적한다.

**Architecture:** 파서가 네이버 결과를 `{ organic, ai_briefing }`로 분리 반환 → 두 수집 경로(클라 `scraper.ts`, 서버 `scheduled-crawl`)가 `crawl_results.is_ai_briefing` 플래그로 각각 저장 → 기존 organic 소비자는 `is_ai_briefing=false` 필터 추가, 신규 AI 마크 카드/추이 그래프는 `is_ai_briefing=true`만 조회. 같은 블로그가 양쪽에 공존 가능(별도 행).

**Tech Stack:** Next.js 14 (App Router, `src/views`) + React 18 + TanStack Query + shadcn/ui + Recharts / Supabase (Postgres + Edge Functions, Deno) / 파서 테스트는 deno test.

## Global Constraints

- dev 서버 포트는 **3030** 고정. 접속 URL `http://localhost:3030`. `npm run build` 후 dev 재시작 전 `.next/` 삭제.
- Supabase 프로젝트 ref: **`txhkcaasbedzbdstsvco`**. 마이그레이션·함수 배포는 링크된 supabase CLI 필요(미링크 시 access token을 지휘관에게 요청 = 에스컬레이션).
- 새 컬럼/함수 마이그레이션 직후 `src/integrations/supabase/types.ts` **재생성 필수**(Netlify `tsc` 빌드 깨짐 방지).
- deno 실행 파일: `C:/Users/enliple/.deno/bin/deno.exe`.
- git push·Netlify 배포는 **명시 요청 시에만**. 이 계획의 커밋은 전부 **로컬 커밋**(푸시 안 함). Edge Function deploy·db push는 별개로 직접 수행.
- 화면 컴포넌트는 `src/views/`·`src/components/`. `src/pages/` 금지.
- 앵커: AI 브리핑 식별은 클래스 `fds-aib`(실측 검증). 빌드 해시 클래스 사용 금지.

---

### Task 1: 파서 — `fds-aib` 분류 + `{ organic, ai_briefing }` 분리 반환

**Files:**
- Modify: `supabase/functions/scrape-search/parser.ts`
- Test: `supabase/functions/scrape-search/parser_test.ts`

**Interfaces:**
- Produces: `parseNaverIntegratedResults(markdown, rawHtml): { organic: BlogResult[]; ai_briefing: BlogResult[] }`, `isInAiBriefing(el: Element): boolean`, `interface NaverParseResult`.
- Consumes: 기존 `BlogResult`, `isValidBlogPostUrl`, `isInExcludedSection`, `cleanTitle`, `buildMarkdownTitleMap`, `extractAuthorFromUrl`, `detectBlogPlatform`, `LINK_NODE_SELECTOR`, `MAX_RESULTS`, `DEFAULT_TITLE` (변경 없음).

- [ ] **Step 1: 기존 테스트를 새 반환 형태로 갱신하고 fds-aib 실패 테스트 추가**

`parser_test.ts`에서 기존 4개 테스트의 `parseNaverIntegratedResults(...)` 반환을 `{ organic }` 구조분해로 바꾸고 `results.length`→`organic.length`, `results.map`→`organic.map`, `results[0]`→`organic[0]`으로 교체한다. 그리고 아래 신규 테스트를 파일 끝(마지막 `Deno.test` 뒤)에 추가한다:

```ts
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
```

구체적으로, 기존 테스트 4곳을 다음처럼 바꾼다:
- `"정상 게시물만 추출하고..."`: `const results = ...` → `const { organic: results } = ...` (나머지 본문 그대로 재사용 가능).
- `"data-url 속성(SDS 버튼)에서도 추출한다"`: 동일하게 `const { organic: results } = ...`.
- `"플랫폼/작성자/제목을 올바르게 추출한다"`: `const { organic: results } = ...`.
- `"markdown으로 기본 제목을 보강한다"`: `const { organic: results } = ...`.
- `"MAX_RESULTS(10)를 초과하지 않는다"`: `const { organic: results } = ...`.

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `C:/Users/enliple/.deno/bin/deno.exe test --allow-net supabase/functions/scrape-search/parser_test.ts`
Expected: FAIL — 신규 테스트가 `parseNaverIntegratedResults(...).organic` 이 undefined이거나(현재 배열 반환) 컴파일 에러. 기존 테스트도 구조분해 불일치로 실패.

- [ ] **Step 3: parser.ts에 briefing 분류 구현**

`parser.ts`에서 `BlogResult` 인터페이스 아래에 추가:

```ts
export interface NaverParseResult {
  organic: BlogResult[];
  ai_briefing: BlogResult[];
}
```

`isInExcludedSection` 함수 정의 바로 아래에 추가:

```ts
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
```

`parseNaverIntegratedResults` 함수 **전체**를 다음으로 교체:

```ts
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
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `C:/Users/enliple/.deno/bin/deno.exe test --allow-net supabase/functions/scrape-search/parser_test.ts`
Expected: PASS (기존 + 신규 전부).

- [ ] **Step 5: 실측 HTML 회귀 검증 (누수 해소 확인)**

`scratchpad/analyze.ts`를 새 반환 형태에 맞춰 `const { organic: ranked } = parseNaverIntegratedResults(md, html);`로 고친 뒤:
Run: `C:/Users/enliple/.deno/bin/deno.exe run --allow-read --allow-net scratchpad/analyze.ts`
Expected: "누수 판정"에서 AI 브리핑 URL 2건이 organic에 **0건**, organic #1 = `blog.naver.com/sanghyo1026/...`.

- [ ] **Step 6: 커밋**

```bash
git add supabase/functions/scrape-search/parser.ts supabase/functions/scrape-search/parser_test.ts
git commit -m "feat(parser): AI 브리핑(fds-aib) 블로그를 organic 순위에서 분리 반환"
```

---

### Task 2: scrape-search 응답에 `ai_briefing` 추가 + 배포

**Files:**
- Modify: `supabase/functions/scrape-search/index.ts:104-117`

**Interfaces:**
- Consumes: Task 1의 `parseNaverIntegratedResults(...): NaverParseResult`.
- Produces: HTTP 응답 JSON에 `ai_briefing: BlogResult[]` 필드(구글은 항상 `[]`).

- [ ] **Step 1: 엔진 분기 수정**

`index.ts`에서 아래 블록:

```ts
    const blogResults = engine === 'google'
      ? parseGoogleResults(markdown, rawHtml)
      : parseNaverIntegratedResults(markdown, rawHtml);

    console.log(`Found ${blogResults.length} blog results (${engine})`);
```

을 다음으로 교체:

```ts
    let blogResults: BlogResult[];
    let aiBriefingResults: BlogResult[] = [];
    if (engine === 'google') {
      blogResults = parseGoogleResults(markdown, rawHtml);
    } else {
      const parsed = parseNaverIntegratedResults(markdown, rawHtml);
      blogResults = parsed.organic;
      aiBriefingResults = parsed.ai_briefing;
    }

    console.log(`Found ${blogResults.length} organic + ${aiBriefingResults.length} ai_briefing results (${engine})`);
```

그리고 응답 본문의 `results: blogResults,` 다음 줄에 추가:

```ts
        ai_briefing: aiBriefingResults,
```

파일 상단 import에 `BlogResult` 타입이 필요하므로 `import { parseNaverIntegratedResults } from "./parser.ts";` 를 `import { parseNaverIntegratedResults, type BlogResult } from "./parser.ts";` 로 수정.

- [ ] **Step 2: 타입 체크**

Run: `C:/Users/enliple/.deno/bin/deno.exe check supabase/functions/scrape-search/index.ts`
Expected: 에러 없음.

- [ ] **Step 3: 배포**

Run: `npx supabase functions deploy scrape-search --project-ref txhkcaasbedzbdstsvco`
Expected: Deployed 성공 메시지. (미링크/인증 실패 시 → 지휘관에게 access token 요청 = 에스컬레이션, 여기서 중단.)

- [ ] **Step 4: 라이브 스모크 (선택, 크레딧 1)**

`scratchpad/capture.ts`를 재실행해(키는 env var로) `윈도우캡쳐`의 응답이 아니라 파서 재현으로 확인 — 이미 Task 1 Step 5에서 검증됨. 배포 자체는 응답 구조만 바뀌므로 Step 2 통과로 충분.

- [ ] **Step 5: 커밋**

```bash
git add supabase/functions/scrape-search/index.ts
git commit -m "feat(scrape-search): 응답에 ai_briefing 분리 필드 추가"
```

---

### Task 3: 마이그레이션 — `is_ai_briefing` 컬럼 + 타입 반영

**Files:**
- Create: `supabase/migrations/20260709000000_crawl_results_ai_briefing.sql`
- Modify: `src/types/database.ts:44` (CrawlResult 인터페이스)
- Regenerate: `src/integrations/supabase/types.ts`

**Interfaces:**
- Produces: `crawl_results.is_ai_briefing boolean NOT NULL DEFAULT false`. `CrawlResult.is_ai_briefing: boolean`.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/20260709000000_crawl_results_ai_briefing.sql`:

```sql
-- AI 브리핑 블로그를 organic 순위와 분리 저장하기 위한 플래그.
-- 기존 행은 전부 organic(false)으로 간주 (과거 데이터 재분류 불가).
ALTER TABLE public.crawl_results
  ADD COLUMN IF NOT EXISTS is_ai_briefing boolean NOT NULL DEFAULT false;

-- organic 조회(순위/통계/추이)가 브리핑 행을 제외할 때 쓰는 부분 인덱스.
CREATE INDEX IF NOT EXISTS idx_crawl_results_organic
  ON public.crawl_results (keyword_id, crawled_at)
  WHERE is_ai_briefing = false;
```

- [ ] **Step 2: db push**

Run: `npx supabase db push --project-ref txhkcaasbedzbdstsvco`
Expected: 마이그레이션 1건 적용 성공. (실패 시 에스컬레이션.)

- [ ] **Step 3: 손 타입에 컬럼 추가**

`src/types/database.ts`의 `CrawlResult` 인터페이스에서 `thumbnail_url: string | null;` 다음 줄에 추가:

```ts
  is_ai_briefing: boolean;
```

- [ ] **Step 4: Supabase 타입 재생성**

Run: `npx supabase gen types typescript --project-id txhkcaasbedzbdstsvco > src/integrations/supabase/types.ts`
Then verify: `grep -c "is_ai_briefing" src/integrations/supabase/types.ts`
Expected: 3 이상 (Row/Insert/Update).

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (이 시점엔 아직 insert 경로가 컬럼 없이 동작 — DEFAULT false로 문제 없음).

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/20260709000000_crawl_results_ai_briefing.sql src/types/database.ts src/integrations/supabase/types.ts
git commit -m "feat(db): crawl_results.is_ai_briefing 컬럼 + 타입 재생성"
```

---

### Task 4: 클라이언트 수동 크롤(`scraper.ts`) — 브리핑 행 저장

**Files:**
- Modify: `src/lib/api/scraper.ts:18-35` (타입), `src/lib/api/scraper.ts:183-207` (insert)

**Interfaces:**
- Consumes: Task 2의 응답 `ai_briefing: BlogResult[]`.
- Produces: `crawl_results`에 organic 행(`is_ai_briefing:false`) + briefing 행(`is_ai_briefing:true`).

- [ ] **Step 1: 응답 타입 확장**

`scraper.ts`의 `interface ScrapeResponse` 안 `results?: BlogResult[];` 다음 줄에 추가:

```ts
  ai_briefing?: BlogResult[];
```

- [ ] **Step 2: insert 로직에 briefing 추가**

`if (result.success && result.results) {` 블록 안에서, 기존 organic insert 매핑의 각 객체에 `is_ai_briefing: false`를 추가하고, `await supabase.from('crawl_results').insert(resultsToInsert);` **직후**에 briefing insert를 추가한다. 해당 블록을 다음으로 교체:

```ts
        if (result.success && result.results) {
          // Deduplicate by URL before inserting
          const seenUrls = new Set<string>();
          const uniqueResults = result.results.filter((r) => {
            if (seenUrls.has(r.url)) return false;
            seenUrls.add(r.url);
            return true;
          });

          const resultsToInsert = uniqueResults.map((r) => ({
            job_id: job.id,
            keyword_id: kw.id,
            search_engine_id: engine.id,
            rank: r.rank,
            blog_title: r.title,
            blog_author: r.author,
            blog_url: r.url,
            snippet: r.snippet,
            published_date: r.published_date,
            blog_platform: r.platform,
            thumbnail_url: r.thumbnail_url,
            is_ai_briefing: false,
          }));

          await supabase.from('crawl_results').insert(resultsToInsert);

          // AI 브리핑 행은 별도 플래그로 저장 (organic과 공존)
          if (result.ai_briefing && result.ai_briefing.length > 0) {
            const briefingSeen = new Set<string>();
            const briefingRows = result.ai_briefing
              .filter((r) => {
                if (briefingSeen.has(r.url)) return false;
                briefingSeen.add(r.url);
                return true;
              })
              .map((r) => ({
                job_id: job.id,
                keyword_id: kw.id,
                search_engine_id: engine.id,
                rank: r.rank,
                blog_title: r.title,
                blog_author: r.author,
                blog_url: r.url,
                snippet: r.snippet,
                published_date: r.published_date,
                blog_platform: r.platform,
                thumbnail_url: r.thumbnail_url,
                is_ai_briefing: true,
              }));
            if (briefingRows.length > 0) {
              await supabase.from('crawl_results').insert(briefingRows);
            }
          }

          successful++;
        } else {
          failed++;
        }
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/lib/api/scraper.ts
git commit -m "feat(scraper): AI 브리핑 행을 is_ai_briefing=true로 별도 저장"
```

---

### Task 5: 자동 크롤(`scheduled-crawl`) — 브리핑 행 저장 + 배포

**Files:**
- Modify: `supabase/functions/scheduled-crawl/index.ts:196-216`

**Interfaces:**
- Consumes: Task 2의 응답 `ai_briefing`.
- Produces: 자동 수집도 organic/briefing 분리 저장.

- [ ] **Step 1: insert 루프에 briefing 추가 + organic 플래그**

`if (data.success && data.results) {` 블록을 다음으로 교체:

```ts
          if (data.success && data.results) {
            for (const r of data.results) {
              await supabase.from('crawl_results').insert({
                job_id: job.id,
                keyword_id: kw.id,
                search_engine_id: engine.id,
                rank: r.rank,
                blog_title: r.title,
                blog_author: r.author,
                blog_url: r.url,
                snippet: r.snippet,
                published_date: r.published_date,
                blog_platform: r.platform,
                thumbnail_url: r.thumbnail_url,
                is_ai_briefing: false,
              });
            }
            for (const r of (data.ai_briefing ?? [])) {
              await supabase.from('crawl_results').insert({
                job_id: job.id,
                keyword_id: kw.id,
                search_engine_id: engine.id,
                rank: r.rank,
                blog_title: r.title,
                blog_author: r.author,
                blog_url: r.url,
                snippet: r.snippet,
                published_date: r.published_date,
                blog_platform: r.platform,
                thumbnail_url: r.thumbnail_url,
                is_ai_briefing: true,
              });
            }
            chunkSuccess++;
          } else {
            chunkFail++;
            console.error(`스크랩 실패 ${kw.keyword}/${engine.name}:`, data.error);
          }
```

- [ ] **Step 2: 타입 체크**

Run: `C:/Users/enliple/.deno/bin/deno.exe check supabase/functions/scheduled-crawl/index.ts`
Expected: 에러 없음.

- [ ] **Step 3: 배포**

Run: `npx supabase functions deploy scheduled-crawl --project-ref txhkcaasbedzbdstsvco`
Expected: Deployed 성공.

- [ ] **Step 4: 커밋**

```bash
git add supabase/functions/scheduled-crawl/index.ts
git commit -m "feat(scheduled-crawl): AI 브리핑 행 별도 저장"
```

---

### Task 6: `useCrawlResults` — `aiBriefing` 필터 옵션

**Files:**
- Modify: `src/hooks/useCrawlResults.ts:20-45`

**Interfaces:**
- Produces: `useCrawlResults({ ..., aiBriefing?: 'exclude' | 'only' })`. 기본 `'exclude'` → `.eq('is_ai_briefing', false)`. `'only'` → `.eq('is_ai_briefing', true)`. 미지정 호출부는 자동으로 organic-only(이중계상 방지).

- [ ] **Step 1: 필터 시그니처·쿼리 수정**

`useCrawlResults`의 filters 타입에 옵션 추가 — `crawled_after?: string;` 다음 줄에:

```ts
  // organic(순위)만 / AI 브리핑만. 기본 organic만.
  aiBriefing?: 'exclude' | 'only';
```

그리고 `.limit(limit);` 다음, `if (filters?.keyword_id)` 앞에 삽입:

```ts
      const aiMode = filters?.aiBriefing ?? 'exclude';
      query = query.eq('is_ai_briefing', aiMode === 'only');
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (기존 호출부는 옵션 미지정 → 기본 exclude).

- [ ] **Step 3: dev 수동 검증**

Run: `npm run dev` (포트 3030). `http://localhost:3030/results` 접속 → 기존 순위표가 정상 표시되고 브리핑 유입이 없는지 확인(과거 데이터는 전부 false라 변화 없음, 신규 수집분부터 분리). 확인 후 dev 중지.

- [ ] **Step 4: 커밋**

```bash
git add src/hooks/useCrawlResults.ts
git commit -m "feat(useCrawlResults): aiBriefing 필터(기본 organic만)"
```

---

### Task 7: organic 집계 소비자에 `is_ai_briefing=false` 필터

**Files:**
- Modify: `src/hooks/useStatistics.ts` (5개 쿼리), `src/hooks/useCrawlResults.ts` (useDashboardStats 3개 쿼리)
- Create: `supabase/migrations/20260709010000_refresh_excludes_ai_briefing.sql`

**Interfaces:**
- Consumes: `crawl_results.is_ai_briefing`.
- Produces: 통계/대시보드/외부블로거 집계가 organic만 계산.

- [ ] **Step 1: useStatistics 5개 쿼리에 필터 추가**

`useStatistics.ts`의 아래 5개 `supabase.from('crawl_results')...` 각각에 `.eq('is_ai_briefing', false)`를 체인 추가:
- Line 57: `supabase.from('crawl_results').select('rank', { count: 'exact' })` → 끝에 `.eq('is_ai_briefing', false)`
- Line 106-109: `.eq('search_engine_id', engine.id)` 다음에 `.eq('is_ai_briefing', false)`
- Line 138: `.select('blog_platform').limit(50000)` → `.select('blog_platform').eq('is_ai_briefing', false).limit(50000)`
- Line 167: `.select('crawled_at, search_engine_id').limit(50000)` → `.eq('is_ai_briefing', false)` 추가
- Line 220: `.select('rank').limit(50000)` → `.eq('is_ai_briefing', false)` 추가

- [ ] **Step 2: useDashboardStats 3개 쿼리에 필터 추가**

`useCrawlResults.ts`의 `useDashboardStats` 안:
- Line 125: `supabase.from('crawl_results').select('crawled_at').order(...).limit(1)` → `.eq('is_ai_briefing', false)` 추가
- Line 126: `supabase.from('crawl_results').select('id').gte('crawled_at', today)` → `.eq('is_ai_briefing', false)` 추가
- Line 134-136: count 쿼리 `.select('*', { count:'exact', head:true })` → `.eq('is_ai_briefing', false)` 추가

- [ ] **Step 3: refresh_top_external_bloggers 필터 마이그레이션**

`supabase/migrations/20260709010000_refresh_excludes_ai_briefing.sql` — `20260612030000` 파일 내용을 그대로 복사하되 두 `base` CTE의 `WHERE cr.crawled_at >= now() - (p::text || ' days')::interval` 를 각각 다음으로 바꾼다:

```sql
      WHERE cr.crawled_at >= now() - (p::text || ' days')::interval
        AND cr.is_ai_briefing = false
```

파일 끝에 `SELECT public.refresh_top_external_bloggers();` 유지(즉시 갱신).

> 전체 함수 본문은 `20260612030000_refresh_uses_contracted_only.sql`와 동일하며 위 2줄만 추가된다. 복사 시 `CREATE OR REPLACE FUNCTION` 본문 전체를 그대로 옮기고 해당 WHERE만 수정할 것.

- [ ] **Step 4: db push**

Run: `npx supabase db push --project-ref txhkcaasbedzbdstsvco`
Expected: 마이그레이션 1건 적용 + refresh 실행 성공.

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/hooks/useStatistics.ts src/hooks/useCrawlResults.ts supabase/migrations/20260709010000_refresh_excludes_ai_briefing.sql
git commit -m "fix: organic 통계/대시보드/외부블로거 집계에서 AI 브리핑 행 제외"
```

---

### Task 8: 수집결과 화면 — AI 마크 카드

**Files:**
- Create: `src/components/results/AiBriefingCard.tsx`
- Modify: `src/components/results/ResultsTable.tsx` (import + 렌더 위치 + briefing 조회)

**Interfaces:**
- Consumes: `useCrawlResults({ keyword_id, crawl_date, aiBriefing: 'only' })`, `buildMatchers`/`getMatchType` (기존), `CrawlResult`.
- Produces: `<AiBriefingCard results={CrawlResult[]} matchers={ReturnType<typeof buildMatchers>} />`.

- [ ] **Step 1: AiBriefingCard 컴포넌트 작성**

`src/components/results/AiBriefingCard.tsx`:

```tsx
import { Sparkles, ExternalLink, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMatchType, type MatchType } from '@/hooks/useBlogUrls';
import type { CrawlResult } from '@/types/database';
import { cn } from '@/lib/utils';

interface Props {
  results: CrawlResult[];
  matchers: Parameters<typeof getMatchType>[1];
}

// AI 브리핑에 인용된 블로그(전체) — 순위와 별개, 우리(공식/협업) 블로그는 강조.
export function AiBriefingCard({ results, matchers }: Props) {
  if (!results || results.length === 0) return null;

  // rank(브리핑 내부 순서) 오름차순, URL 중복 제거
  const seen = new Set<string>();
  const rows = [...results]
    .sort((a, b) => a.rank - b.rank)
    .filter((r) => (seen.has(r.blog_url) ? false : (seen.add(r.blog_url), true)));

  return (
    <Card className="border-violet-500/30 bg-violet-500/5 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-violet-500" />
          AI 브리핑 노출 ({rows.length})
          <span className="text-xs font-normal text-muted-foreground">순위와 별개로 네이버 AI가 인용한 블로그</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const matchType: MatchType = getMatchType(r.blog_url, matchers);
          const isOurs = matchType === 'official_blog' || matchType === 'exact_url' || matchType === 'same_blog_id';
          return (
            <div
              key={r.id}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                matchType === 'official_blog' && 'bg-violet-500/15',
                matchType === 'exact_url' && 'bg-emerald-500/15',
                matchType === 'same_blog_id' && 'bg-sky-500/15',
                matchType === 'expired_blogger' && 'bg-red-500/10',
                !isOurs && matchType !== 'expired_blogger' && 'bg-background',
              )}
            >
              <span className={cn('font-medium line-clamp-1 flex-1', isOurs && 'text-foreground')}>
                {r.blog_title}
                {isOurs && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/20 text-violet-700 dark:text-violet-300">
                    우리 블로그
                  </span>
                )}
              </span>
              {r.blog_author && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  {r.blog_author}
                </span>
              )}
              <a href={r.blog_url} target="_blank" rel="noopener noreferrer"
                className="p-1 rounded hover:bg-muted">
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: ResultsTable에 조회·렌더 연결**

`ResultsTable.tsx` import에 추가:

```ts
import { AiBriefingCard } from './AiBriefingCard';
```

`const { data: results, isLoading } = useCrawlResults({...});` 바로 다음에 briefing 조회 추가:

```ts
  const { data: briefingResults } = useCrawlResults({
    keyword_id: selectedKeywordId || undefined,
    crawl_date: selectedDate || undefined,
    aiBriefing: 'only',
  });
```

briefing은 엔진/프로그램 필터를 동일 적용하기 위해 `matchers` 정의 다음에 파생값 추가:

```ts
  const briefingForView = useMemo(() => {
    if (!briefingResults) return [];
    let f = briefingResults;
    if (selectedProgram) f = f.filter((r) => r.keyword?.program === selectedProgram);
    if (selectedEngine) f = f.filter((r) => r.search_engine?.name === selectedEngine);
    return f;
  }, [briefingResults, selectedProgram, selectedEngine]);
```

렌더에서 "Highlight Legend" `<div>` **바로 앞**(즉 `{/* Highlight Legend */}` 위)에 삽입:

```tsx
      <AiBriefingCard results={briefingForView} matchers={matchers} />
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: dev 수동 검증**

Run: `npm run dev` (3030). AI 브리핑이 있던 키워드(`윈도우캡쳐`)를 한 번 수동 수집 → `/results`에서 해당 키워드/오늘 날짜 선택 → 순위표 위에 "AI 브리핑 노출" 카드가 뜨고, 카드 블로그가 순위표에는 (브리핑 유입으로) 안 들어가는지 확인. dev 중지.

- [ ] **Step 5: 커밋**

```bash
git add src/components/results/AiBriefingCard.tsx src/components/results/ResultsTable.tsx
git commit -m "feat(results): AI 브리핑 노출 카드(순위 상단, 우리 블로그 강조)"
```

---

### Task 9: 순위 추이 — AI 브리핑 노출 별도 그래프

**Files:**
- Create: `src/components/trends/AiBriefingTrend.tsx`
- Modify: `src/views/Trends.tsx`

**Interfaces:**
- Consumes: `useCrawlResults({ latestOnly:false, crawled_after, aiBriefing:'only' })`, `useKeywords`, `useBloggers`, `OFFICIAL_BLOG_ID`, `extractBlogId`.
- Produces: `<AiBriefingTrend />` — 키워드별 우리 블로그의 AI 브리핑 노출 여부(날짜 점).

- [ ] **Step 1: AiBriefingTrend 컴포넌트 작성**

`src/components/trends/AiBriefingTrend.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCrawlResults } from '@/hooks/useCrawlResults';
import { useKeywords } from '@/hooks/useKeywords';
import { useBloggers } from '@/hooks/useBloggers';
import { OFFICIAL_BLOG_ID, extractBlogId } from '@/hooks/useBlogUrls';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

const DATE_RANGES = [
  { value: '7', label: '최근 7일' },
  { value: '14', label: '최근 14일' },
  { value: '30', label: '최근 30일' },
];

// 우리 블로그가 AI 브리핑에 노출된 (키워드 × 날짜) 점. y축 = 키워드.
export function AiBriefingTrend() {
  const [dateRange, setDateRange] = useState('14');

  const cutoffIso = useMemo(() => {
    const now = new Date();
    const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
    const start = Math.floor(kstMs / 86400000) * 86400000 - (parseInt(dateRange) - 1) * 86400000;
    return new Date(start - 9 * 60 * 60 * 1000).toISOString();
  }, [dateRange]);

  const { data: briefing } = useCrawlResults({ latestOnly: false, crawled_after: cutoffIso, aiBriefing: 'only' });
  const { data: keywords } = useKeywords();
  const { data: bloggers = [] } = useBloggers();

  const ourBlogIds = useMemo(() => {
    const s = new Set<string>([OFFICIAL_BLOG_ID]);
    bloggers.forEach((b) => { if (b.blog_id && b.status === '계약됨') s.add(b.blog_id); });
    return s;
  }, [bloggers]);

  const getKeywordName = (id: string) => keywords?.find((k) => k.id === id)?.keyword || id;

  // 우리 블로그가 브리핑에 노출된 (kwId, date) 유니크 점
  const { points, kwOrder } = useMemo(() => {
    const set = new Set<string>();
    const kwIds: string[] = [];
    (briefing ?? []).forEach((r) => {
      const bid = extractBlogId(r.blog_url);
      if (!bid || !ourBlogIds.has(bid)) return;
      const date = format(parseISO(r.crawled_at), 'yyyy-MM-dd');
      const key = `${r.keyword_id}|${date}`;
      if (set.has(key)) return;
      set.add(key);
      if (!kwIds.includes(r.keyword_id)) kwIds.push(r.keyword_id);
    });
    const order = kwIds;
    const pts = [...set].map((k) => {
      const [kwId, date] = k.split('|');
      return { x: parseISO(date).getTime(), y: order.indexOf(kwId), kwId, date };
    });
    return { points: pts, kwOrder: order };
  }, [briefing, ourBlogIds]);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI 브리핑 노출 추이 (우리 블로그)
          </CardTitle>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              {DATE_RANGES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>기간 내 우리 블로그의 AI 브리핑 노출이 없습니다.</p>
          </div>
        ) : (
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number" dataKey="x" domain={['dataMin', 'dataMax']}
                  tickFormatter={(v) => format(new Date(v), 'MM/dd', { locale: ko })}
                  tick={{ fontSize: 12 }} scale="time"
                />
                <YAxis
                  type="number" dataKey="y" domain={[-0.5, Math.max(0, kwOrder.length - 1) + 0.5]}
                  ticks={kwOrder.map((_, i) => i)}
                  tickFormatter={(v) => getKeywordName(kwOrder[v])}
                  tick={{ fontSize: 12 }} width={80} interval={0}
                />
                <ZAxis range={[120, 120]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(_v, _n, p: any) => [format(new Date(p.payload.x), 'yyyy-MM-dd'), getKeywordName(p.payload.kwId)]}
                />
                <Scatter data={points} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Trends 뷰에 추가**

`src/views/Trends.tsx` import에 추가:

```ts
import { AiBriefingTrend } from '@/components/trends/AiBriefingTrend';
```

`<RankTrendChart />` 다음 줄에 추가:

```tsx
        <AiBriefingTrend />
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: dev 수동 검증**

Run: `npm run dev` (3030). `/trends` 접속 → 기존 순위 추이 아래에 "AI 브리핑 노출 추이" 카드. 우리 블로그가 브리핑에 노출된 이력이 있으면 점, 없으면 빈 상태 문구. dev 중지.

- [ ] **Step 5: 커밋**

```bash
git add src/components/trends/AiBriefingTrend.tsx src/views/Trends.tsx
git commit -m "feat(trends): AI 브리핑 노출 추이 별도 그래프"
```

---

### Task 10: 통합 빌드 검증

- [ ] **Step 1: dev 중지 후 프로덕션 빌드**

Run(정확히 이 순서): dev 종료 → `rm -rf .next` → `npm run build`
Expected: 빌드 성공 (tsc 엄격 검사 통과). 실패 시 types.ts 재생성 누락 여부 우선 확인.

- [ ] **Step 2: 빌드 산출물 정리 후 dev 복귀 가능 상태 확인**

Run: `rm -rf .next`
(이후 dev 필요 시 `npm run dev` = 3030.)

- [ ] **Step 3: 최종 확인 (푸시/배포는 지휘관 지시 대기)**

로컬 커밋만 완료된 상태. `git log --oneline -10`으로 Task 1~9 커밋 확인. **git push·Netlify 배포는 명시 요청 시에만.** Edge Function(scrape-search, scheduled-crawl) 및 db push는 각 Task에서 이미 수행됨.

---

## Self-Review

**Spec coverage:**
- 파서 fds-aib 분류 + 반환 분리 → Task 1 ✓
- 응답 ai_briefing → Task 2 ✓
- is_ai_briefing 컬럼 + types 재생성 → Task 3 ✓
- 두 수집 경로 저장(scraper, scheduled-crawl) → Task 4, 5 ✓
- organic 소비자 필터(useCrawlResults 기본, Statistics, DashboardStats, refresh_top_external_bloggers) → Task 6, 7 ✓
- AI 마크 카드(전체 브리핑, 우리 강조) → Task 8 ✓
- 추이 별도 그래프(우리 노출 여부) → Task 9 ✓
- 공존(같은 블로그 양쪽) → 파서가 버킷별 dedup(Task 1) + 두 insert 분리(Task 4,5) ✓
- 네이버 전용(구글 ai_briefing=[]) → Task 2 분기 ✓
- 과거 데이터 한계 → 마이그레이션 DEFAULT false(Task 3) 주석 명시 ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함, TODO/TBD 없음.

**Type consistency:** `NaverParseResult { organic, ai_briefing }`(Task1) ↔ index.ts `parsed.organic/parsed.ai_briefing`(Task2) ↔ 응답 `ai_briefing`(Task2) ↔ `ScrapeResponse.ai_briefing`(Task4)/`data.ai_briefing`(Task5) ↔ `CrawlResult.is_ai_briefing`(Task3) ↔ `aiBriefing:'exclude'|'only'`(Task6) 일치. `getMatchType(url, matchers)` 시그니처 재사용(Task8). `extractBlogId`, `OFFICIAL_BLOG_ID`, `status==='계약됨'` 우리블로그 정의는 RankTrendChart와 동일 규칙 재사용(Task9).
