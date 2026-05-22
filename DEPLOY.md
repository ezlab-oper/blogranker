# 배포 가이드 (Netlify + Supabase)

> 프론트엔드는 Netlify(Next.js), 백엔드는 Supabase(DB·Auth·Edge Functions)에 그대로 유지한다.

---

## 0. 사전 요구

- Node.js 18.18+ (Next.js 14 요구사항). Netlify는 `NODE_VERSION` 환경변수로 지정 권장.
- Supabase 프로젝트: `qsxjhiqmxeuuosaivbry`
- Deno (Edge Function 로컬 테스트용, 선택): https://deno.land

---

## 1. Netlify 프론트엔드 배포

### 1-1. 저장소 연결
Netlify > Add new site > Import an existing project > Git 저장소 선택.
빌드 설정은 `netlify.toml` 에서 자동 인식된다:

```toml
[build]
  command = "npm run build"
  publish = ".next"
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### 1-2. 환경변수 등록
Netlify > Site configuration > Environment variables 에 추가:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qsxjhiqmxeuuosaivbry.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | (Supabase anon key) |
| `NEXT_PUBLIC_SUPABASE_PROJECT_ID` | `qsxjhiqmxeuuosaivbry` |
| `NODE_VERSION` | `20` |

> `NEXT_PUBLIC_*` 는 클라이언트 번들에 포함되는 공개 값이다(anon 키는 원래 공개용).
> 민감 키(service_role, Firecrawl, Naver Ad)는 **절대 여기에 넣지 않는다** — Supabase Edge Function secrets에만 둔다.

### 1-3. Supabase Auth 리다이렉트 URL
Supabase > Authentication > URL Configuration 에 Netlify 도메인을 Site URL / Redirect URLs로 추가한다.

---

## 2. Supabase 백엔드 적용

### 2-1. CLI 준비
```sh
npx supabase login            # 액세스 토큰 입력
npx supabase link --project-ref qsxjhiqmxeuuosaivbry
```

### 2-2. DB 마이그레이션 적용 (보안 패치 포함)
```sh
npx supabase db push
```
적용되는 신규 마이그레이션:
- `20260522000000_security_hardening.sql` — 익명 공개정책 제거(authenticated 전용), cron 함수 anon EXECUTE 회수
- `20260522010000_rls_role_granularity.sql` — viewer 읽기전용 / admin·master 쓰기 / settings master 전용

> ⚠️ 적용 후 **로그인 세션 상태**에서 키워드 수집·저장·설정 변경이 정상인지 회귀 확인할 것.
> 로그아웃(익명) 상태에서는 데이터 접근이 차단되는 것이 정상이다.

### 2-3. Edge Function 배포
```sh
npx supabase functions deploy scrape-search
npx supabase functions deploy scheduled-crawl
npx supabase functions deploy naver-keyword-search
npx supabase functions deploy update-cron-schedule
# 그 외: collect-usage, sync-blog-urls, create-admin, delete-admin, update-admin, init-master
```

### 2-4. Function Secrets 설정
```sh
npx supabase secrets set FIRECRAWL_API_KEY=...
npx supabase secrets set NAVER_AD_API_KEY=...
npx supabase secrets set NAVER_AD_SECRET_KEY=...
npx supabase secrets set NAVER_AD_CUSTOMER_ID=...
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY 는 플랫폼 자동 주입
```

---

## 3. 크롤 파서 검증

### 3-1. 로컬 단위 테스트 (Deno)
```sh
deno test --allow-net supabase/functions/scrape-search/parser_test.ts
```
AI/광고 섹션 제외·중복 제거·플랫폼/작성자 추출·MAX_RESULTS·markdown 보강을 픽스처로 검증한다.

### 3-2. 라이브 검증 (배포 후)
대시보드에서 키워드 1건 수집 실행 후 결과 수·순위·플랫폼이 채워지는지 확인.
> 픽스처 테스트는 통과했으나, 실제 네이버 마크업의 클래스명이 픽스처와 다를 수 있다.
> 라이브 결과가 0건이면 `CONTAINER_SELECTOR` / `TITLE_ANCHOR_SELECTOR` 를 실제 HTML 기준으로 조정한다.
> (Edge Function 로그의 응답 `raw_markdown` 으로 실제 구조 확인 가능)

---

## 4. 로컬 개발
```sh
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드 검증
npm run test       # 프론트 단위 테스트(vitest)
```
