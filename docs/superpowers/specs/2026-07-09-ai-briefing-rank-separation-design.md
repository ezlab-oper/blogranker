# AI 브리핑 블로그 순위 분리 — 설계 문서

- 작성일: 2026-07-09
- 대상: blog-ranker (Next.js 14 + Supabase)
- 범위: 네이버 통합검색 AI 브리핑 영역의 블로그를 순위(organic rank)에서 분리 수집

## 1. 문제 정의

네이버 통합검색에 일부 키워드에서 **AI 브리핑** 영역이 노출되며, 이 영역이 인용한 블로그가 현재 크롤 순위에 **그대로 섞여 들어간다.**

### 실측 근거 (2026-07-09, Firecrawl 캡처)

두 키워드를 프로덕션과 동일한 파이프라인으로 캡처·비교:

| 항목 | 화면캡쳐 (브리핑 없음) | 윈도우캡쳐 (브리핑 있음) |
|------|:---:|:---:|
| "AI 브리핑" 텍스트 | 없음 | 있음 (3회) |
| `fds-aib-*` 클래스 | 0 | 13 |
| 파서 순위 결과 수 | 7 | 9 |
| 브리핑 블로그의 순위 침투 | 해당 없음 | **#1, #2 침투 (재현됨)** |

윈도우캡쳐에서 AI 브리핑 블록 내부 블로그 2건(`poalqr04/224243612753`, `hkdong0694/224316707874`)이 문서 최상단에 위치해 **순위 #1·#2를 강탈**, 실제 유기적 1위(`sanghyo1026`)를 #3으로 밀어냄.

### 근본 원인

파서 `parser.ts`의 `EXCLUDED_CLASS_RE`는 **구형 클래스 토큰**(`api_ai_briefing` 등)만 대조한다. 네이버는 SDS 디자인 시스템의 **`fds-aib`** 클래스로 렌더하므로 현재 제외 정규식이 브리핑 체인을 **하나도 매치하지 못한다**(시뮬레이션 결과 match=false). 테스트 픽스처의 `api_ai_briefing`은 손으로 만든 합성값이라 실제 마크업으로 검증된 적이 없다.

## 2. 목표

1. AI 브리핑 영역 블로그를 순위 결과에서 제외한다.
2. 브리핑 블로그를 별도 분류(`is_ai_briefing`)로 수집·저장한다.
3. 수집결과 화면 최상단에 "AI 마크" 섹션으로 브리핑 블로그를 노출한다(순위와 별개).
4. 같은 블로그가 AI 마크와 순위에 **동시 노출**될 수 있다(브리핑+유기적 양쪽 등장 시).
5. 순위 추이 화면에 우리 블로그의 AI 브리핑 **노출 여부**를 별도 그래프로 추적한다.

### 확정된 요구 결정

- 추이 그래프 의미: **우리(공식/협업) 블로그의 노출 여부**(노출/미노출), 브리핑 내 위치가 아님.
- AI 마크 표시 범위: **전체 브리핑 블로그**(경쟁사 포함), 우리 블로그는 강조.

## 3. 저장 구조 (결정: 단일 플래그 컬럼)

`crawl_results` 테이블에 `is_ai_briefing boolean NOT NULL DEFAULT false` 한 컬럼만 추가한다.

- 브리핑 블로그도 같은 테이블의 행으로 저장, 플래그로만 구분.
- 동시 공존: 같은 URL이 순위행(`false`) + 브리핑행(`true`) 2개 행으로 자연스럽게 표현.
- 브리핑 행의 `rank` = 브리핑 내부 등장 순서(1,2,…). (NOT NULL 제약 충족용, 참고값)

대안 기각: `source` enum(값 2개뿐 — YAGNI), 별도 테이블(스키마·훅·쿼리 중복 — 과설계).

## 4. 파서 변경 (`supabase/functions/scrape-search/parser.ts`)

- 새 헬퍼 `isInAiBriefing(el: Element): boolean` — 조상 체인(최대 20단계)에서 클래스에 `fds-aib`를 포함하는 노드를 탐지. 실측 검증된 앵커이며 빌드 해시가 아님.
- `parseNaverIntegratedResults` 반환 타입 변경: `{ organic: BlogResult[]; ai_briefing: BlogResult[] }`.
- 분류 로직 (문서 순서 유지):
  1. 광고 섹션(`isInExcludedSection`) → 기존대로 완전 제외.
  2. **`fds-aib` 하위 → `ai_briefing`** 리스트(브리핑 내부 순서로 rank), organic 카운트에 미포함.
  3. 그 외 → `organic` 리스트(rank 1..MAX_RESULTS 새로 시작).
- 중복 처리: organic·ai_briefing **각 리스트 내부에서만** URL dedup. 두 리스트 간에는 dedup하지 않는다(공존 허용).
- `fds-aib` 앵커의 근거·교체 지점을 `ponytail:` 코멘트로 명시.

## 5. 응답 · 수집 경로 (두 경로 모두)

- `index.ts` (scrape-search): 응답 본문에 `ai_briefing: BlogResult[]` 추가. 파서 신규 반환 형태를 organic/ai_briefing으로 분리 전달.
- `src/lib/api/scraper.ts` (클라이언트 수동 크롤): organic 행은 `is_ai_briefing=false`, briefing 행은 `true`로 각각 `crawl_results`에 insert.
- `scheduled-crawl` (서버 자동 크롤): 동일하게 응답의 `ai_briefing`을 읽어 `is_ai_briefing=true`로 insert. **누락 시 자동수집 경로에서 누수가 지속되므로 필수.**

## 6. DB 마이그레이션 & 소비자 필터

- 마이그레이션: `ALTER TABLE crawl_results ADD COLUMN is_ai_briefing boolean NOT NULL DEFAULT false;`
- 기존 organic 소비자에 **`is_ai_briefing=false` 필터를 추가**한다(누락 시 브리핑 행이 순위·통계에 이중 계상):
  - `src/hooks/useCrawlResults.ts` (순위표 조회)
  - `src/components/trends/RankTrendChart.tsx` (추이 데이터)
  - Statistics(수집 통계) 조회
  - `refresh_top_external_bloggers()` SQL 함수(외부 블로거 집계)
- 마이그레이션·컬럼 추가 직후 `src/integrations/supabase/types.ts` 재생성(엄격 빌드 실패 방지).

## 7. UI — 수집결과 (`/results`)

- 순위 테이블 **위**에 "🤖 AI 브리핑" 카드 신설.
- **전체 브리핑 블로그**를 나열하고, 우리(공식/협업) 블로그는 기존 매칭 로직(`OFFICIAL_BLOG_ID` ∪ 계약됨 `bloggers.blog_id`)으로 색·배지 강조.
- 선택된 키워드/엔진/날짜에 브리핑 행이 없으면 카드 미표시.
- `useCrawlResults`는 organic과 ai_briefing 버킷을 분리 반환(같은 쿼리 결과를 플래그로 split).

## 8. UI — 순위 추이

- 기존 "우리 최저순위" 그래프와 **별도** 섹션으로, 키워드별 **우리 블로그의 AI 브리핑 노출 여부**를 날짜축 위에 점·계단선(노출=마크, 미노출=공백)으로 표시.
- presence(노출 여부)만 표시하며 브리핑 내 위치는 표시하지 않는다.
- 데이터: `crawl_results` where `is_ai_briefing=true` 중 우리 blog_id에 해당하는 행의 날짜 분포.

## 9. 리스크 / 한계

- **과거 데이터 오염**: 배포 이전 크롤 결과의 브리핑 블로그는 이미 organic rank로 저장되어 있고, 당시 원본 HTML이 없어 재분류 불가. 추이 그래프의 배포 이전 구간은 오염된 채 남으며 신규 크롤부터 정확해진다.
- **앵커 취약성**: `fds-aib`는 네이버가 마크업을 재개편하면 깨질 수 있다. 파서 코멘트에 근거·교체 지점을 남긴다.
- **엔진 스코프**: 네이버 전용. 구글은 `is_ai_briefing` 항상 false(구글 AI Overview는 별건, 범위 밖).

## 10. 테스트 포인트

- 파서 단위 테스트(`parser_test.ts`)에 실측 기반 `fds-aib` 픽스처를 추가: 브리핑 블로그가 `ai_briefing`으로 분류되고 organic rank에서 빠지는지, 공존 케이스(양쪽 등장 시 두 리스트에 각각)와 광고 제외가 유지되는지 검증.
- 캡처된 `naver_windowcap.html`로 회귀 검증: 현재 #1·#2 침투가 제거되고 유기적 #1이 `sanghyo1026`으로 올라오는지.
