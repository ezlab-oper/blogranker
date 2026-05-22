# Blog Rank Tracker

네이버 통합검색에서 키워드별 블로그 노출 순위를 추적하는 내부 관리자 도구.

## 기술 스택

- **프레임워크**: Next.js 14 (App Router, CSR 중심)
- **언어/UI**: TypeScript, React 18, shadcn/ui (Radix), TailwindCSS
- **상태/데이터**: TanStack Query
- **백엔드**: Supabase (Postgres + Auth + Edge Functions)
- **크롤링**: Firecrawl API → 네이버 검색 HTML 파싱 (deno-dom)
- **배포**: Netlify (`@netlify/plugin-nextjs`)

## 로컬 실행

```sh
npm install
npm run dev      # http://localhost:3000
```

`.env` 에 다음 값이 필요하다:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SUPABASE_PROJECT_ID=...
```

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run test` | Vitest |

## Netlify 배포

저장소를 Netlify에 연결하면 `netlify.toml` 설정으로 자동 빌드된다.
환경변수(`NEXT_PUBLIC_*`)는 Netlify 사이트 설정 > Environment variables 에 등록한다.

## 구조

- `src/app/` — Next.js App Router (라우트 = 얇은 래퍼, 인증 가드 `ProtectedRoute` 적용)
- `src/views/` — 실제 페이지 화면 컴포넌트
- `src/components/` — UI 및 기능 컴포넌트
- `src/hooks/`, `src/lib/`, `src/contexts/` — 데이터 훅·유틸·인증 컨텍스트
- `supabase/functions/` — Edge Functions (Deno): 크롤링·키워드 검색량·스케줄
- `supabase/migrations/` — DB 스키마 및 RLS 정책
