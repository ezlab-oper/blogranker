# 백로그 (Backlog)

> 진행할 일감 목록. 처리되면 항목을 제거하거나 커밋 메시지에 링크.

---

## [DONE] 구글 검색 지원 활성화 (2026-05-22, 커밋 6b786d8·3944357·968efbf)

✅ `scrape-search`가 `engine` 파라미터 분기, 구글 URL/파서·CAPTCHA 우회(`location:KR + mobile:true`), `parser_google.ts` 신규, search_engines '구글' 시드, 클라이언트/스케줄 크롤 skip 제거, 단일 기준(`isValidBlogPostUrl` = 네이버블로그+티스토리) 통합. 라이브 3키워드 검증 통과.

---

## [P2] 협업 블로거·포스팅 URL 수기 관리 화면

현재 `blog_urls` 테이블(= 협업 블로거의 포스팅 URL·블로그 ID 목록, 공식블로그/협업포스팅 매칭에 사용)은 **구글 시트에서만** 동기화되고 앱에서 직접 추가·수정·삭제할 수 없다. 시트에 못 올리는 한 건이나 즉석 추가 케이스를 위해 **앱 내 수기 등록 화면**이 필요하다.

### 필요한 기능
1. **블로거 추가** — `program` + `blog_id` (URL은 비울 수 있음, 같은 블로거의 다른 글 매칭용 시드 행)
2. **포스팅 URL 추가** — `program` + `blog_url` (입력 시 `blog_id` 자동 추출, 사용자가 덮어쓰기 가능)
3. **목록 조회** — 프로그램별·블로거별 필터, 검색
4. **수정·삭제** — inline edit + 삭제 다이얼로그
5. **CSV 임포트** (선택) — 한번에 여러 행 추가

### 화면 위치 결정 필요
- (A) 새 최상위 메뉴 "협업 블로거" — 컨텐츠 데이터라 설정과 분리 (권장)
- (B) 설정 > 협업 블로거 (관리자/스크래핑 로직 맵과 같은 서브메뉴)

### ⚠️ 시트 동기화 충돌 — **반드시 함께 해결**

현재 [sync-blog-urls/index.ts](supabase/functions/sync-blog-urls/index.ts) 는 sync 시 `blog_urls` 행을 **전부 삭제 후 재삽입** 한다. 수기 추가한 행이 다음 sync에 날아간다.

**해결안 (택1)**:
- **B-1) source 컬럼 추가 (권장)** — `blog_urls`에 `source TEXT NOT NULL DEFAULT 'sheet'` (값: `'sheet'` | `'manual'`). sync는 `source='sheet'` 행만 삭제·재삽입. 수기 행은 보존.
- **B-2) upsert 방식** — sync에서 `delete` 대신 시트에 있는 (program, blog_url) 키만 upsert + 시트에 없는 행은 보존. 시트에서 행 삭제해도 DB에 남는 부작용 있음.
- **B-3) 별도 테이블 분리** — `blog_urls_manual` 신설. 매칭 로직(`useBlogUrls.buildBlogUrlMatchers`)에서 두 테이블 합쳐 사용. 깔끔하지만 변경 범위 큼.

권장: **B-1** (1줄 컬럼 추가 + sync 함수의 delete 조건만 수정).

### 변경 대상
1. **DB 마이그레이션** — `blog_urls`에 `source TEXT NOT NULL DEFAULT 'sheet'` 추가 + 인덱스. 기존 행은 모두 `'sheet'` 자동 설정.
2. **`sync-blog-urls`** — `.delete().neq('id', '0...')` → `.delete().eq('source','sheet')` 로 변경. 새 insert 시 `source: 'sheet'` 명시.
3. **신규 페이지 `BlogUrlManagement.tsx`** (위치 결정 후) — 라우트, ProtectedRoute 가드. 권한은 `canPerformActions`(admin+master) 또는 `canAccessSettings`(master) — 결정 필요.
4. **신규 다이얼로그 컴포넌트** — `BlogUrlAddDialog`(URL 또는 ID 입력, 자동추출, 프로그램 Select).
5. **`useBlogUrls.ts`** — `useAddBlogUrl` / `useUpdateBlogUrl` / `useDeleteBlogUrl` mutation 추가. 모두 `source: 'manual'` 자동 설정. RLS는 [authenticated 정책 + 'admin'/'master' 쓰기](supabase/migrations/20260522010000_rls_role_granularity.sql)로 이미 보호됨.
6. **사이드바 메뉴 등록** — (A)면 최상위, (B)면 `/settings/blog-urls`.

### 검증 (Definition of Done)
- [ ] 화면에서 블로거 1건 + 포스팅 URL 1건 추가 → 새로고침 후에도 목록에 보임.
- [ ] 시트 동기화 후 수기 추가 행이 **사라지지 않음** (source='manual'은 sync delete에서 제외 확인).
- [ ] 시트의 행을 삭제 후 sync → DB에서도 제거됨 (source='sheet' 동작 유지).
- [ ] 수기 추가한 협업 블로거의 글이 크롤되면 Results에서 "협업 블로거" 배지로 매칭됨.
- [ ] 권한 없는 사용자(viewer)는 추가/삭제 버튼 비활성.

### 리스크
- 시트와 수기 데이터가 분리되어 운영 혼란 가능 → 목록 화면에 source 컬럼(시트/수기) 표시 권장.
- 같은 URL을 시트와 수기 양쪽에 등록할 수 있음 → unique(blog_url) 제약 또는 sync 시 중복 감지 처리 필요.
- 시트 마스터 데이터가 정답인 경우 수기 항목이 시트와 어긋날 수 있음 — 운영 정책으로 가이드 필요.

### 우선순위 근거
**P2** — 협업 블로그 매칭 정확도에 직접 영향. 시트에 등록 안 된 신규 협력 블로거를 즉시 반영 못해 현장 운영 불편. 작업량 중간(약 0.5~1일 — 컬럼 추가·sync 수정·CRUD 페이지).

---

## [P3] (이전 일감들은 여기에)
