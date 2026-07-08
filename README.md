# warding-backoffice-fe

NAR.GG 백오피스(admin) 프론트엔드. 이 문서는 이 레포를 AI 주도로 개발할 때 알아야 할 것을 정리한다. 인증·배포·프레임워크 함정 같은 깊은 운영 지식은 `CLAUDE.md`가 단일 출처이고, 이 README는 그 위에서 "어떻게 개발하는가"와 "지금 무엇을 바꾸는가"를 다룬다.

## 개요

운영자가 가입자·선수·팀 명단과 Cron 작업 현황을 조회하는 admin 대시보드다. 백엔드는 별도 레포 `nar-back-repo`(Spring Boot, `https://api.nar.kr`)이고 여기는 그 API에 붙는 프론트만 담당한다. 현재 조회 전용이며 쓰기 기능은 없다.

개발은 Claude Code(AI 에이전트) 주도로 한다. 사람은 방향과 리뷰를 맡고, 코드 작성·수정은 에이전트가 워크트리에서 진행한 뒤 `main`으로 PR을 올린다. 그래서 이 레포의 규칙과 맥락은 대화가 아니라 파일(`CLAUDE.md`, 이 README)에 적어 둔다. 에이전트가 매 세션 처음부터 읽는 것이 이 파일들이기 때문이다.

지금 UI 스택을 Ant Design에서 shadcn/ui + Tailwind로 전환하는 중이다. 아래 "스택"과 "전환 방향"에 현재 상태와 목표를 나눠 적었다.

## 스택

현재와 목표 스택을 구분한다. Refine 코어와 데이터·인증 계층은 그대로 두고 UI 레이어만 교체한다.

| 계층 | 현재 | 목표 |
|------|------|------|
| 프레임워크 | Refine v5 (`@refinedev/core`) | 유지 |
| UI 라이브러리 | Ant Design v5 (`@refinedev/antd`) | shadcn/ui (Radix + Tailwind) |
| 스타일 | antd 테마 | Tailwind CSS |
| 빌드 | Vite 6 + React 19 + TS | 유지 |
| 라우팅 | `@refinedev/react-router` (BrowserRouter) | 유지 |
| 데이터 | 커스텀 dataProvider (Spring `Page` 어댑터) | 유지 |
| 인증 | 커스텀 authProvider (구글 OAuth) | 유지 |
| 배포 | Vercel → `admin.nar.kr` | 유지 |

현재 UI는 Claude가 임의로 만든 것이 아니라 Refine CLI 스캐폴드에 antd 컴포넌트를 얹은 구조다. 리소스 페이지(`src/pages/{members,players,teams,cron-jobs}`)는 `@refinedev/antd`의 `useTable`과 antd `<Table>`로 목록을 그린다. 사이드바·타이틀·인증 흐름만 커스텀이다.

## AI 주도 개발 방식

이 레포는 상위 프로젝트(`nar`)와 같은 트렁크 기반 개발을 따른다. `main`이 유일한 트렁크이고 항상 배포 가능한 상태를 유지한다.

1. `main`은 직접 수정하지 않는다. 모든 변경은 PR로 들어온다.
2. 작업은 `main`에서 딴 단기 브랜치(`feat/*`, `fix/*`)에서 하고, 가능하면 하루 이틀 안에 머지한다.
3. 에이전트는 워크트리에서 작업한 뒤 `main`을 타깃으로 PR을 올린다.
4. 문서·주석·커밋 메시지는 한국어로 쓴다.

에이전트가 맥락을 잃지 않도록 세 가지를 지킨다. 첫째, 운영 지식(인증·배포·프레임워크 함정)은 `CLAUDE.md`에만 적고 중복하지 않는다. 둘째, 의도적인 단순화는 코드에 `ponytail:` 주석으로 남긴다(예: dataProvider가 조회만 구현한 이유). 셋째, 결정 사항은 이 README에 반영해 다음 세션이 다시 묻지 않게 한다.

## 개발 시 알아야 할 것

작업 전에 확인할 최소 사실이다. 세부는 각 항목이 가리키는 파일을 본다.

조회 전용이다. dataProvider의 `create`·`update`·`deleteOne`은 의도적으로 막혀 있다(`src/providers/data.ts`). 쓰기 화면을 요청받으면 백엔드 admin API에 해당 엔드포인트가 있는지부터 확인한다.

데이터 규약은 Spring Boot다. 목록은 `GET /api/admin/{resource}?page=0&size=20&sort=field,asc`로 요청하고 `{ content, totalElements }` 형태의 Spring `Page`를 받는다. 페이지 번호는 0부터 시작한다. dataProvider가 이 변환을 흡수하므로 페이지 컴포넌트는 Refine 훅만 쓴다.

인증은 구글 OAuth 리다이렉트 방식이고 admin 권한은 백엔드 DB `member.role`로 판별한다. 첫 admin 부트스트랩 방법과 토큰·CORS·콜백 URL 함정은 `CLAUDE.md`의 "인증 흐름"과 "함정"에 있다. 인증 관련 작업은 그 절을 먼저 읽는다.

배포는 Vercel이고 `main` push로 자동 배포된다. `VITE_API_URL`은 빌드 시점에 번들에 박히므로 Vercel 환경변수 설정이 필수다. DNS는 Route53에서 관리한다. 배포·도메인 세부는 `CLAUDE.md`의 "배포"에 있다.

Refine v5 API는 v4와 다르다. `useTable`·`useList`의 페이지는 `currentPage`이고 `useList` 반환은 `{ result, query }`다. 자세한 차이는 `CLAUDE.md`에 정리돼 있다.

## 전환 방향: shadcn + Tailwind

Ant Design을 걷어내고 shadcn/ui로 UI를 재구축한다. Refine 코어는 UI에 독립적이라 데이터·인증·라우팅 계층은 손대지 않는다. 바꾸는 것은 화면을 그리는 레이어뿐이다.

바뀌는 것과 그대로인 것을 먼저 구분한다.

| 대상 | 조치 |
|------|------|
| `@refinedev/antd` | 제거. `useTable` 등 UI 바인딩 훅을 `@refinedev/core`의 헤드리스 훅으로 교체 |
| antd `<Table>`·`<List>` | shadcn `<Table>` + TanStack Table로 교체 |
| antd 테마·`reset.css` | Tailwind로 교체 |
| `@refinedev/core` dataProvider·authProvider | 유지 |
| 라우팅 구조(`src/App.tsx`) | 유지. UI 껍데기(`ThemedLayout`)만 자체 레이아웃으로 교체 |

전환 순서는 되돌리기 위험을 줄이도록 잡는다. 새 UI가 완성되기 전까지 antd를 섞어 둔 상태로 머지해도 화면은 계속 동작해야 한다.

1. Tailwind와 shadcn/ui를 설치하고 `vite.config.ts`·`tsconfig.json`에 경로 별칭과 Tailwind 플러그인을 추가한다.
2. 레이아웃 껍데기(사이드바·헤더)를 shadcn 컴포넌트로 먼저 옮긴다. `@refinedev/antd`의 `ThemedLayout`을 자체 레이아웃으로 대체한다.
3. 리소스 페이지를 하나씩 옮긴다. 각 페이지에서 `@refinedev/antd`의 `useTable`을 `@refinedev/core`의 `useTable`로 바꾸고 shadcn `<Table>`로 렌더한다. `members` 목록이 가장 단순하니 이것부터 한다.
4. 모든 페이지 전환이 끝나면 `@refinedev/antd`와 antd 의존성을 제거한다.

전환하며 지킬 것이 있다. Refine 훅 시그니처는 그대로다(헤드리스 코어도 `currentPage` 페이지네이션과 서버 정렬을 같은 방식으로 쓴다). 다크 모드는 antd `ColorModeContext` 대신 Tailwind `dark:` 클래스와 `class` 전략으로 다시 구현한다. shadcn은 라이브러리가 아니라 코드 생성 방식이므로, 컴포넌트는 `src/components/ui`에 생성해 레포에 커밋한다.

## 명령

```bash
npm install
npm run dev      # 로컬 dev(5173). 기본 VITE_API_URL=localhost:8080
npm run build    # tsc && refine build → dist
```

로컬 백엔드를 띄우려면 `nar-back-repo`를 참고한다. MySQL, Elasticsearch(nori 플러그인), `service-account-key.json`, `application-dev.yml`이 필요하다.

## 관련 레포

- 백엔드: `NAR-GG/nar-back-repo` (admin API: `/api/admin/{members,players,teams,cron-jobs}`)
- 모바일(Flutter): `NAR-GG/warding-mobile-repo`
- 웹 프론트(Next.js): `NAR-GG/nar-front-repo`
