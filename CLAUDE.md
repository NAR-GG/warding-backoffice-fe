# CLAUDE.md — warding-backoffice-fe

NAR.GG 백오피스(admin) 프론트엔드. 이 파일은 작업 세션(사람/AI 모두)이 참고하는 단일 가이드다.

## 언어
모든 서술형 산출물(문서/주석/커밋)은 **한국어**.

## 무엇인가
- 운영자가 가입자/선수/팀 명단, Cron 작업 현황, 리그별 설정을 관리하는 **admin 대시보드**.
- 백엔드는 별도 레포 `nar-back-repo`(Spring Boot, `https://api.nar.kr`). 여기는 그 API에 붙는 프론트만.
- **조회 + 수정/삭제**(가입자·선수·팀 삭제, LCK 선수 팀 이동/이미지 수정, 리그 설정 토글). create만 없음 — dataProvider 레벨에서 차단.

## 스택
- **Refine v5 (headless)** + **shadcn/ui (Radix)** + **Tailwind CSS v4** + Vite 6 + React 19 + TS strict
- 라우팅: `@refinedev/react-router` (BrowserRouter)
- 상태/데이터: Refine + TanStack Query (내부)
- 토스트: sonner. 아이콘: lucide-react. 클래스 조합: `cn()` (`src/lib/utils.ts`)
- ~~Ant Design~~ → PR #1에서 shadcn/Tailwind로 전환 완료. antd 관련 과거 문서/커밋은 무시.

## 구조 (핵심 파일)
| 파일 | 역할 |
|------|------|
| `src/providers/data.ts` | Spring `Page`(`{content,totalElements}`) 흡수 커스텀 데이터프로바이더. `Bearer` 헤더 부착. create만 차단 |
| `src/providers/auth.ts` | authProvider. 구글 OAuth 리다이렉트 + localStorage 토큰 + JWT exp 검증 + 401/403 로그아웃 |
| `src/providers/constants.ts` | `API_URL` = `import.meta.env.VITE_API_URL ?? localhost:8080` |
| `src/providers/notification.ts` | Refine 알림 → sonner 토스트 매핑 |
| `src/components/layout.tsx` | 셸: 사이드바(로고+메뉴+로그아웃) + 헤더(테마 토글) + Outlet |
| `src/components/data-table.tsx` | 공용 테이블. 정렬 헤더/검색(300ms 디바운스)/필터 슬롯/페이지네이션/로딩·빈 상태 내장 |
| `src/components/delete-row-button.tsx` | 행 삭제 버튼(confirm → `useDelete` 호출) |
| `src/components/league-select.tsx` | 검색형 콤보박스(기본=LCK, 전체 리그 옵션). players에서 팀 이동 시 사용 |
| `src/components/theme-provider.tsx` | 라이트/다크 (`.dark` 클래스 + localStorage) |
| `src/components/ui/*` | shadcn 컴포넌트 (**직접 수정 금지** — 아래 컨벤션 참조) |
| `src/pages/{members,players,teams}/list.tsx` | 목록(서버 페이징/정렬/검색) |
| `src/pages/cron-jobs/list.tsx` | Cron 카탈로그(배열 응답, 클라 정렬/필터) |
| `src/pages/league-configs/list.tsx` | 리그 설정 토글(의존 체인: sync→live→알림) |
| `src/pages/players/edit-dialogs.tsx` | 선수 수정 모달(팀 이동/이미지 URL/솔랭 계정 수정). 서버 검증(LCK 출전 이력) 의존 |
| `src/pages/auth/{login,callback}.tsx` | 로그인 버튼 / OAuth 콜백(토큰 저장) |
| `src/index.css` | Tailwind v4 진입점 + OKLch 테마 토큰(`@theme inline`) |

## 컨벤션 (팀/AI 공통 규칙)
- **파일명 kebab-case** (`league-select.tsx`), 컴포넌트 PascalCase, 훅 `use` 접두사, 상수 UPPER_SNAKE.
- 페이지는 named export (`export const MemberList`), `src/pages/{resource}/list.tsx` + `index.ts` 재수출.
- 스타일은 **Tailwind 클래스만** (인라인 style 금지). 조건부 클래스는 `cn()`.
- `src/components/ui/`(shadcn)는 **수정 금지**. 커스텀이 필요하면 감싸는 컴포넌트를 `src/components/`에 새로 만든다.
- 새 shadcn 컴포넌트 추가: `npx shadcn@latest add <name>` (`components.json` 설정 사용).
- 경로 별칭 `@/` = `src/`.
- Refine v5 API 주의:
  - pagination은 `currentPage`(not `current`), `useList` 반환은 `{ result, query }`(not `{data, isLoading}`).
  - `useUpdate`/`useDelete` 반환은 `{ mutate, mutation }` (mutation.isPending 사용). hooks/data/useUpdate.d.ts의 flat 타입 선언은 stale — 런타임은 래핑 반환.
  - `setFilters` 기본 behavior는 "merge" (명시 인자 없이도 기존 필터 유지).

### 새 목록 페이지 추가 템플릿
1. `src/pages/{resource}/list.tsx` — 아래 패턴 복사 (members가 최소 예시, players가 필터 슬롯 예시):
```tsx
const columns: Column<T>[] = [{ key: "id", title: "ID", sortable: true }, ...];

export const XxxList = () => {
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<T>({ resource: "xxx", sorters: { initial: [{ field: "...", order: "desc" }] } });
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">제목</h1>
      <DataTable columns={columns} rows={result?.data ?? []} rowKey="id"
        isLoading={tableQuery.isLoading} sorters={sorters} setSorters={setSorters}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }])}
        searchPlaceholder="..." />
    </section>
  );
};
```
2. `src/App.tsx`의 Refine `resources`에 리소스 + 라우트 등록.
3. 백엔드 admin API(`/api/admin/{resource}`)가 Spring `Page`를 반환하면 dataProvider가 그대로 흡수. 배열 응답이면 cron-jobs 패턴(클라 정렬/필터) 참조.
- 이 보일러플레이트를 훅/팩토리로 추상화하지 말 것 — 페이지당 ~50줄, 변하는 부분(컬럼/정렬/필터)만 남아 있음.

### 폼/모달이 필요해지면
현재 폼 없음. 생기면 참조 레포(liveklass)의 패턴을 따른다: React Hook Form + Zod(`zodResolver`) + shadcn Dialog, 스키마는 페이지 옆 `schemas.ts`. 미리 설치하지 말 것.

## UI/UX 참조 레포: `~/dev/liveklass-backoffice-main`
이 레포의 컴포넌트/UX를 기반으로 확장한다. 같은 스택(React 19 + Refine + shadcn/Tailwind)이라 패턴 이식 용이. 참고 지점:
- 고급 테이블(컬럼 고정/리사이즈/표시 토글/localStorage 유지): `src/components/data-table/` + `src/hooks/use-table-with-storage.ts`
- 모달 폼(RHF+Zod): `src/features/*/ui/*-modal.tsx`, 쿼리 훅: `src/features/*/lib/queries.ts`
- 기능이 커지면 feature-module 구조(`features/{name}/{ui,lib}`)로 전환 — 현재 규모(~1.5k LOC)에선 불필요.
- **그대로 복사 금지 항목**: Cognito 인증(여긴 구글 OAuth+Spring), i18n(여긴 한국어 하드코딩), 자동생성 API 타입.

## 보안 (AI 세션 필수 준수)
- `VITE_` env는 **전부 번들에 노출**됨 — 비밀 절대 금지. API URL만 허용.
- 토큰은 localStorage(`accessToken`) + Bearer 헤더. **토큰 처리 로직(auth.ts/data.ts) 변경 시 반드시 사람 리뷰 요청.**
- `dangerouslySetInnerHTML` 금지. 외부 HTML 렌더가 필요해지면 DOMPurify 도입(liveklass `SafeHtml` 참조).
- dataProvider의 create 차단은 의도된 설계 — 쓰기 기능 추가 요청이 아니면 풀지 말 것.
- 선수 수정은 서버가 LCK 출전 이력을 재검증 — 프론트 필터를 보안 경계로 취급하지 말 것.
- 시크릿/키/DB 접속정보를 코드·문서·커밋에 남기지 말 것.

## 인증 흐름 (중요)
1. 로그인 버튼 → `{API}/oauth2/authorization/google?target=backoffice`
2. 구글 → 백엔드 콜백 → `{backoffice-url}/oauth/callback?accessToken=...`
3. `callback.tsx`가 localStorage 저장 → 이후 모든 API 호출에 `Bearer` 헤더
4. 백엔드가 `member.role == ADMIN` 인지 JWT claim 으로 판별. 아니면 403.
- `auth.ts`의 `check()`는 JWT `exp`까지 검증(만료 토큰 → 로그인 페이지).

### 권한(ROLE) = 백엔드 DB
- admin 권한은 prod DB `member.role` 컬럼. 부여: `UPDATE member SET role='ADMIN' WHERE id=?` → **재로그인** 시 반영(JWT에 role claim 박힘, access token 30분).
- 백오피스 로그인은 **기존 회원만, 회원 생성 안 함**(`findAdminMember`). 미등록/비ADMIN → 거부 후 `/login`.

## ⚠️ 함정 (다음 세션 주의)
1. **첫 admin 부트스트랩**: 백오피스 로그인은 회원을 생성하지 않으므로, DB에 `member` 행만 수동 INSERT 해도 **안 됨**(연결된 `member_social`(google provider_id) 행이 없어서 OAuth 조회 실패). 부트스트랩:
   - 브라우저에 `https://api.nar.kr/oauth2/authorization/google` (**target 파라미터 없이** = 일반 로그인) 직접 입력 → 회원+member_social 정상 생성 → `role='ADMIN'` 승격 → 백오피스 재로그인.
2. **VITE_API_URL은 빌드 시점에 번들에 박힘**. Vercel env 에 `VITE_API_URL=https://api.nar.kr` 설정 필수(안 하면 prod가 localhost 가리킴). 비밀 아님(브라우저 노출됨).
3. **백엔드와 커플링** (도메인/오리진 바뀌면 nar-back-repo도 수정):
   - CORS: `CorsConfig.ALLOWED_ORIGINS` 에 백오피스 도메인 등록
   - OAuth 콜백: `BACKOFFICE_URL` env (deploy.yml 에 주입)
4. **`vercel.json` SPA rewrite 필수**: 없으면 `/members` 등 새로고침 시 404.
5. dataProvider는 fetch를 `redirect: "manual"`로 호출 — Spring의 302→HTML 루프 방지. 건드리지 말 것.
6. **수동 수정한 선수 이미지는 `image_locked`로 보호됨** — 자동 동기화가 못 덮는다. 팀 메타데이터(name/code/imageUrl)는 여전히 매일 04:15 sync가 덮어씀(팀 수정 기능 없는 이유). 선수 `current_team_id`는 sync 무관(수동 전용). 선수 솔랭 계정도 `game_accounts_locked`로 동일 보호(크롤러 05:30이 못 덮음). puuid 반영은 06:00 크론 자동.

## 배포
- **Vercel** (Hobby, 팀 `Warding-Backoffice`). `main` push → 자동 빌드/배포.
- 도메인: **`admin.nar.kr`**.
- **DNS는 가비아 아니라 AWS Route53**에서 관리(nar.kr 네임서버 = awsdns). 가비아 패널에 넣으면 무시됨. Route53 nar.kr 존에 레코드 추가:
  - CNAME `admin` → Vercel 타깃(`*.vercel-dns-017.com`)
  - TXT `_vercel` → Vercel 소유권 검증값(다른 Vercel 계정에 nar.kr 연결돼 있어 필요)

## 명령
```bash
npm install
npm run dev      # 로컬 dev (5173). 기본 VITE_API_URL=localhost:8080
npm run build    # tsc && refine build → dist
```
로컬 백엔드 띄우려면 nar-back-repo 참고(MySQL + Elasticsearch+nori 플러그인 + service-account-key.json + application-dev.yml 필요).

## 관련 레포
- 백엔드: `NAR-GG/nar-back-repo` (admin API: `/api/admin/{members,players,teams,cron-jobs,league-configs}` — GET/PUT/DELETE)
- UI/UX 참조: `~/dev/liveklass-backoffice-main` (위 섹션 참조)
- 모바일(Flutter, 카카오 SDK 로그인): `NAR-GG/warding-mobile-repo`
- 기존 웹 프론트(Next.js): `NAR-GG/nar-front-repo`
