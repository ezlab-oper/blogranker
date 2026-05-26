# 백로그 (Backlog)

> 진행할 일감 목록. 처리되면 항목을 제거하거나 커밋 메시지에 링크.

---

## [P3] 구글 검색 지원 활성화

현재 구글 검색은 **UI 골격과 타입만 남아 있고 실제 런타임에선 즉시 skip돼 동작하지 않는다**.
활성화하려면 백엔드 크롤 함수·클라이언트 분기·DB 시드·파서를 모두 손봐야 한다.

### 현재 상태 (참고)
- UI/통계/스크래핑 로직맵엔 "구글" 탭·배지·차트가 있고 타입은 `'naver' | 'google'`까지 정의됨.
- 그러나 [scraper.ts:143-148](src/lib/api/scraper.ts) — `// Only Naver is supported now` 주석과 함께 비-네이버 엔진을 `continue` 처리.
- [scheduled-crawl/index.ts:157-162](supabase/functions/scheduled-crawl/index.ts) — `Skipping non-Naver engine` 로그 후 `continue`.
- [scrape-search/index.ts](supabase/functions/scrape-search/index.ts) — `searchUrl`이 네이버로 하드코딩(`engine` 파라미터 무시).
- `search_engines` 테이블은 '네이버' 행만 시드됨 ([20260522030000_seed_search_engines.sql](supabase/migrations/20260522030000_seed_search_engines.sql)).

### 변경 대상

1. **Edge Function `scrape-search`**
   - 요청 body의 `engine` 파라미터를 받아 분기 (현재는 받지도 않음).
   - Google URL: `https://www.google.com/search?q={keyword}&hl=ko&ie=UTF-8`.
   - 구글용 파서를 별도 모듈로 작성(`parser_google.ts`). 기존 `parser.ts`(네이버용) 구조 재사용 — DOM 셀렉터·`a[href]/[data-url]` 추출 + 블로그 도메인 화이트리스트.
   - 컨테이너 기준(참고 — [ScrapingLogicMap.tsx:122-148](src/views/ScrapingLogicMap.tsx)): `#center_col > #rso > div.MjjYud`. 구글도 마크업 자주 바뀌므로 클래스 비의존 설계 권장(블로그 도메인 URL만 문서순으로 수집).

2. **클라이언트 크롤 `scraper.ts`**
   - skip 분기 제거 + `engineType`을 `engine.name`(또는 enum 컬럼)으로 결정.
   - `scrape-search` 호출 시 `engine`을 body로 전달.

3. **스케줄 크롤 `scheduled-crawl`**
   - 비-네이버 skip 분기 제거. 네이버·구글 모두 처리하도록 루프.

4. **DB 시드 마이그레이션** — `search_engines`에 '구글' 행 추가.
   ```sql
   INSERT INTO public.search_engines (name, base_url, is_active)
   VALUES ('구글', 'https://www.google.com/search', true)
   ON CONFLICT (name) DO NOTHING;
   ```

5. **파서 테스트** — 구글 검색 결과 HTML 픽스처로 `parser_google_test.ts` 추가 (네이버 파서와 동일 패턴, `deno test`).

### 검증 (Definition of Done)
- [ ] `scrape-search`에 `{"keyword":"...", "engine":"google"}`로 직접 호출 → 결과 5건 이상.
- [ ] 앱에서 키워드 1건 수집 시 네이버·구글 양쪽에서 결과 수집(Results 페이지에 양쪽 배지 정상).
- [ ] 통계 차트에 구글 카운트 정상 누적 표시.
- [ ] 스크래핑 로직맵 구글 탭 내용을 실제 구현과 일치하도록 갱신.
- [ ] `parser_google_test.ts` 통과.

### 리스크
- 구글은 봇 탐지가 강함 → Firecrawl waitFor에도 일관성 변동 가능. 키워드별 안정성 모니터링 필요.
- 결과가 지역 파라미터(`hl=ko`, `gl=kr`)에 따라 달라짐 → 정책 결정 필요.
- 마크업 변경 시 셀렉터/추출 로직 재조정 필요(네이버 SDS 사례와 동일 패턴).
- 매칭 로직(공식블로그/협업 포스팅) 영향 없음 — URL 기반이므로 엔진과 무관.

### 우선순위 근거
**P3** — 네이버만으로 핵심 기능(블로그 랭크 트래킹) 충족 중. 한국 블로그 검색에서 구글 점유율이 낮아 부수적. UI 골격이 이미 있어 활성화 비용은 중간(약 1~2일).
