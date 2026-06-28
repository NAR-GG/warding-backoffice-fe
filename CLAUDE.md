# CLAUDE.md — warding-backoffice-fe

NAR.GG 백오피스(admin) 프론트엔드. 이 파일은 향후 작업 세션(특히 Claude)이 참고할 가이드다.

## 언어
모든 서술형 산출물(문서/주석/커밋)은 **한국어**.

## 무엇인가
- 운영자가 가입자/선수/팀 명단, Cron 작업 현황을 조회하는 **admin 대시보드**.
- 백엔드는 별도 레포 `nar-back-repo`(Spring Boot, `https://api.nar.kr`). 여기는 그 API에 붙는 프론트만.
- **조회 전용**(현재 쓰기 기능 없음).

## 스택
- **Refine v5** + **Ant Design v5** + **Vite 6** + React 19 + TS
- 라우팅: `@refinedev/react-router` (BrowserRouter)
- 상태/데이터: Refine + TanStack Query (내부)

## 구조 (핵심 파일)
| 파일 | 역할 |
|------|------|
| `src/providers/data.ts` | Spring `Page`(`{content,totalElements}`) 흡수하는 커스텀 데이터프로바이더. `Authorization: Bearer` 헤더 부착. 조회 전용(create/update/delete 막힘) |
| `src/providers/auth.ts` | authProvider. 구글 OAuth 리다이렉트 로그인 + localStorage 토큰 + 401 처리 |
| `src/providers/constants.ts` | `API_URL` = `import.meta.env.VITE_API_URL ?? localhost:8080` |
| `src/pages/{members,players,teams}/list.tsx` | 목록(서버 페이징/정렬) |
| `src/pages/cron-jobs/list.tsx` | Cron 카탈로그(페이징 없음, 클라 정렬) |
| `src/pages/auth/{login,callback}.tsx` | 로그인 버튼 / OAuth 콜백(토큰 저장) |
| `src/components/sider.tsx` | 커스텀 사이드바: 로고 + 로그아웃 하단 고정 |
| `src/components/title.tsx` | 로고(테마별 흰/검 스왑) |

## 인증 흐름 (중요)
1. 로그인 버튼 → `{API}/oauth2/authorization/google?target=backoffice`
2. 구글 → 백엔드 콜백 → `{backoffice-url}/oauth/callback?accessToken=...`
3. `callback.tsx`가 localStorage 저장 → 이후 모든 API 호출에 `Bearer` 헤더
4. 백엔드가 `member.role == ADMIN` 인지 JWT claim 으로 판별. 아니면 403.

### 권한(ROLE) = 백엔드 DB
- admin 권한은 prod DB `member.role` 컬럼. 부여: `UPDATE member SET role='ADMIN' WHERE id=?` → **재로그인** 시 반영(JWT에 role claim 박힘, access token 30분).
- 백오피스 로그인은 **기존 회원만, 회원 생성 안 함**(`findAdminMember`). 미등록/비ADMIN → 거부 후 `/login`.

## ⚠️ 함정 (다음 세션 주의)
1. **첫 admin 부트스트랩**: 백오피스 로그인은 회원을 생성하지 않으므로, DB에 `member` 행만 수동 INSERT 해도 **안 됨**(연결된 `member_social`(google provider_id) 행이 없어서 OAuth 조회 실패). 부트스트랩 방법:
   - 브라우저에 `https://api.nar.kr/oauth2/authorization/google` (**target 파라미터 없이** = 일반 로그인)을 직접 입력 → 회원+member_social 정상 생성 → 그 회원을 `role='ADMIN'` 으로 승격 → 백오피스 재로그인.
2. **VITE_API_URL은 빌드 시점에 번들에 박힘**. Vercel env 에 `VITE_API_URL=https://api.nar.kr` 설정 필수(안 하면 prod가 localhost 가리킴). 비밀 아님(브라우저에 노출됨).
3. **백엔드와 커플링** (도메인/오리진 바뀌면 nar-back-repo도 수정):
   - CORS: `CorsConfig.ALLOWED_ORIGINS` 에 백오피스 도메인 등록
   - OAuth 콜백: `BACKOFFICE_URL` env (deploy.yml 에 주입)
4. **`vercel.json` SPA rewrite 필수**: 없으면 `/members` 등 새로고침 시 404.
5. Refine v5 API: `useTable`/`useList` 의 pagination 은 `currentPage`(not `current`), `useList` 반환은 `{ result, query }`(not `{data, isLoading}`).
6. 사이드바 커스텀: `ThemedSider` 의 `render` 로 메뉴를 직접 그릴 땐 **antd `<Menu>` 로 감싸야** 들여쓰기/패딩 유지(안 그러면 왼쪽에 달라붙음). 선택 하이라이트는 `useMenu().selectedKey`.

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
- 백엔드: `NAR-GG/nar-back-repo` (admin API: `/api/admin/{members,players,teams,cron-jobs}`)
- 모바일(Flutter, 카카오 SDK 로그인): `NAR-GG/warding-mobile-repo`
- 기존 웹 프론트(Next.js): `NAR-GG/nar-front-repo`
