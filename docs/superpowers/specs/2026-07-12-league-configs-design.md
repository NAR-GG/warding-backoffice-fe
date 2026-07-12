# 리그 설정 관리 화면 설계 (프론트 전용)

2026-07-12 승인. 라이브 이벤트 수집·디스코드 알림·경기 동기화 대상 리그를 백오피스 화면에서 리그별 토글로 관리한다.

## 배경

- 백엔드 `nar-back-repo`의 `LeagueConstants.TARGET_LEAGUES`(9개 리그: LCK, LPL, LEC, LCS, LCP, CBLOL, MSI, WORLDS, FIRST_STAND)가 컴파일 타임 하드코딩.
- 라이브 폴링(`LivePollingScheduler`)은 이 상수 전체 순회, 디스코드 알림은 env(기본 LCK), 동기화는 env `LOL_ACTIVE_LEAGUES`.
- 이번 작업은 **프론트만**. 백엔드(설정 테이블 + admin API)는 아래 계약대로 별도 세션에서 구현.

## API 계약 (백엔드 구현 기준)

```
GET /api/admin/league-configs
→ 200 [{ "leagueName": "LCK", "liveEnabled": true, "notificationEnabled": true, "syncEnabled": true }, ...]
  (9개 고정, 페이징 없음, 배열 응답)

PUT /api/admin/league-configs/{leagueName}
body: { "liveEnabled": bool, "notificationEnabled": bool, "syncEnabled": bool }
→ 200 갱신된 행 (GET 항목과 동일 형태)
```

- 필드 의미: `liveEnabled` = 라이브 이벤트 수집(폴링) 대상, `notificationEnabled` = 디스코드 알림 대상, `syncEnabled` = 경기 일정/결과 동기화 대상.
- 인증: 기존 admin API와 동일 (`Authorization: Bearer`, ADMIN role).

## 프론트 변경

### 1. 리소스/라우트
- Refine 리소스 `league-configs` 등록, 라우트 `/league-configs`.
- 사이드바 메뉴 "리그 설정" 추가.

### 2. `src/providers/data.ts`
- `update` 구현: `PUT {API_URL}/api/admin/{resource}/{id}` + Bearer 헤더, 응답 JSON 반환.
- `create` / `deleteOne`은 계속 reject (조회 전용 원칙 유지, update만 개방).

### 3. `src/pages/league-configs/list.tsx`
- cron-jobs 리스트 패턴 복제: `useList`(pagination off).
- 테이블: 리그명 + 토글 3열 (라이브 수집 / 디스코드 알림 / 동기화).
- 토글 컴포넌트: shadcn `switch` 1파일 추가 (`src/components/ui/switch.tsx`).
- 토글 클릭 → `useUpdate`로 해당 행 3개 값 전체 PUT.
  - 뮤테이션 중 해당 행 토글 disabled.
  - 성공 시 Refine 기본 동작으로 리스트 리페치.
  - 실패 시 sonner 토스트로 에러 표시 (리페치가 원복 겸함).
- 옵티미스틱 업데이트 없음 (어드민 도구, 불필요).

### 4. 백엔드 미구현 동안
- 화면은 로드 에러 상태 표시. 목데이터 만들지 않음.

## 에러 처리
- GET 실패: 기존 리스트 페이지들과 동일한 에러 표시.
- PUT 실패(401/403/네트워크): sonner 토스트 + 리페치로 토글 상태 원복.

## 검증
- `npm run build` 통과.
- 화면 렌더 확인 (백엔드 없으므로 에러 상태까지 확인).
- 백엔드 구현 후 실제 토글 동작은 별도 세션에서 검증.
