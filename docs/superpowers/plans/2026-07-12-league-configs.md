# 리그 설정 관리 화면 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리그별 라이브 수집·디스코드 알림·경기 동기화를 토글하는 백오피스 화면 (`/league-configs`).

**Architecture:** 기존 cron-jobs 리스트 패턴 복제. Refine 리소스 `league-configs` + `useList`(pagination off) + 행별 shadcn Switch 3개 → 토글 즉시 `useUpdate` PUT. 데이터프로바이더에 `update`만 개방(create/delete는 계속 차단).

**Tech Stack:** Refine v5, shadcn/ui + Tailwind v4, radix-ui(모놀리식 패키지), sonner(notificationProvider 경유).

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-07-12-league-configs-design.md`
- API 계약: `GET /api/admin/league-configs` → 배열(9개, 페이징 없음) / `PUT /api/admin/league-configs/{leagueName}` body `{ liveEnabled, notificationEnabled, syncEnabled }`
- 백엔드 미구현 상태 — 화면은 로드 에러가 정상. 목데이터 금지.
- 서술형 산출물(주석/커밋) 한국어 (CLAUDE.md).
- 테스트 프레임워크 없음 — 검증은 `npm run build`(tsc 포함) + 수동 확인.
- Refine v5 주의: `useList` 반환은 `{ result, query }`.
- 사이드바 메뉴는 `useMenu()`가 App.tsx `resources`에서 자동 생성 — 별도 사이드바 수정 없음.

---

### Task 1: 데이터프로바이더 `update` 개방

**Files:**
- Modify: `src/providers/data.ts`

**Interfaces:**
- Produces: `dataProvider.update({ resource, id, variables })` → `PUT {API_URL}/api/admin/{resource}/{id}` JSON body, `{ data }` 반환. Task 2의 `useUpdate`가 사용.

- [ ] **Step 1: `http` 헬퍼에 method/body 지원 추가**

`src/providers/data.ts`의 `http` 함수(10–29행)를 다음으로 교체:

```ts
const http = async (
  path: string,
  search?: URLSearchParams,
  init?: { method: string; body: unknown }
) => {
  const url = `${API_URL}${path}${search && [...search].length ? `?${search}` : ""}`;
  const token = getToken();
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init ? { "Content-Type": "application/json" } : {}),
    },
    body: init ? JSON.stringify(init.body) : undefined,
    // 미인증 시 Spring Security 는 302 로 /login 리다이렉트한다. 기본 fetch 는 이를 따라가
    // HTML(200)을 받아 JSON 파싱이 깨진다 → 401 감지 실패. manual 로 막고 아래서 401 처리.
    redirect: "manual",
  });
  // opaqueredirect(302 차단) 또는 401/403 → 인증 실패로 통일 → authProvider.onError 가 로그아웃
  if (res.type === "opaqueredirect" || res.status === 401 || res.status === 403) {
    throw Object.assign(new Error("인증이 필요합니다"), { statusCode: 401 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`${res.status} ${res.statusText} — ${url}`), {
      statusCode: res.status,
    });
  }
  return res.json();
};
```

- [ ] **Step 2: `update` 구현, 파일 상단 주석 갱신**

64–66행의 세 reject 중 `update`를 교체:

```ts
  create: () => Promise.reject(new Error("백오피스는 조회 전용입니다")),
  update: async ({ resource, id, variables }) => ({
    data: await http(`/api/admin/${resource}/${id}`, undefined, {
      method: "PUT",
      body: variables,
    }),
  }),
  deleteOne: () => Promise.reject(new Error("백오피스는 조회 전용입니다")),
```

8행 주석을 갱신:

```ts
// ponytail: 조회 + update 만 구현. create/delete 필요해지면 그때 추가.
```

- [ ] **Step 3: 빌드 검증**

Run: `npm run build`
Expected: `tsc` 에러 없이 통과, `dist` 생성.

- [ ] **Step 4: Commit**

```bash
git add src/providers/data.ts
git commit -m "feat: 데이터프로바이더 update 개방 (PUT + JSON body)

리그 설정 토글용. create/delete 는 계속 차단.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 리그 설정 페이지 + 라우트/리소스 등록

**Files:**
- Create: `src/components/ui/switch.tsx`
- Create: `src/pages/league-configs/list.tsx`
- Create: `src/pages/league-configs/index.ts`
- Modify: `src/App.tsx` (import, resources 배열, Routes)

**Interfaces:**
- Consumes: Task 1의 `dataProvider.update` (Refine `useUpdate` 경유).
- Produces: `/league-configs` 라우트, 사이드바 "리그 설정" 메뉴(리소스 등록으로 자동).

- [ ] **Step 1: shadcn Switch 컴포넌트 생성**

`src/components/ui/switch.tsx` 생성 (shadcn 표준 switch, 이 레포의 radix 모놀리식 import 방식):

```tsx
import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
```

- [ ] **Step 2: 리스트 페이지 생성**

`src/pages/league-configs/list.tsx` 생성:

```tsx
import { useState } from "react";
import { useList, useUpdate } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";
import { Switch } from "@/components/ui/switch";

// 리그별 수집/알림/동기화 토글. 백엔드: GET /api/admin/league-configs (배열, 페이징 없음),
// PUT /api/admin/league-configs/{leagueName} body { liveEnabled, notificationEnabled, syncEnabled }
type LeagueConfig = {
  leagueName: string;
  liveEnabled: boolean;
  notificationEnabled: boolean;
  syncEnabled: boolean;
};

type ToggleKey = "liveEnabled" | "notificationEnabled" | "syncEnabled";

export const LeagueConfigList = () => {
  const { result, query } = useList<LeagueConfig>({
    resource: "league-configs",
    pagination: { mode: "off" },
  });
  const { mutate } = useUpdate<LeagueConfig>();
  // 뮤테이션 중인 행: 해당 행 토글만 잠금. 옵티미스틱 없음 — 성공 리페치가 화면 갱신.
  const [pending, setPending] = useState<string | null>(null);

  const toggle = (row: LeagueConfig, key: ToggleKey) => {
    setPending(row.leagueName);
    mutate(
      {
        resource: "league-configs",
        id: row.leagueName,
        values: {
          liveEnabled: row.liveEnabled,
          notificationEnabled: row.notificationEnabled,
          syncEnabled: row.syncEnabled,
          [key]: !row[key],
        },
        successNotification: false,
        errorNotification: () => ({
          message: "설정 변경 실패",
          description: "잠시 후 다시 시도해 주세요",
          type: "error",
        }),
      },
      { onSettled: () => setPending(null) }
    );
  };

  const toggleColumn = (key: ToggleKey, title: string): Column<LeagueConfig> => ({
    key,
    title,
    render: (row) => (
      <Switch
        checked={row[key]}
        disabled={pending === row.leagueName}
        onCheckedChange={() => toggle(row, key)}
      />
    ),
  });

  const columns: Column<LeagueConfig>[] = [
    { key: "leagueName", title: "리그" },
    toggleColumn("liveEnabled", "라이브 수집"),
    toggleColumn("notificationEnabled", "디스코드 알림"),
    toggleColumn("syncEnabled", "경기 동기화"),
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">리그 설정</h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="leagueName"
        isLoading={query.isLoading}
      />
    </section>
  );
};
```

`src/pages/league-configs/index.ts` 생성:

```ts
export { LeagueConfigList } from "./list";
```

- [ ] **Step 3: App.tsx 리소스·라우트 등록**

`src/App.tsx` 세 군데 수정.

import 추가 (`CronJobList` import 아래):

```tsx
import { LeagueConfigList } from "./pages/league-configs";
```

`resources` 배열에 항목 추가 (cron-jobs 다음):

```tsx
                { name: "league-configs", list: "/league-configs", meta: { label: "리그 설정" } },
```

인증 영역 Routes에 라우트 추가 (`/cron-jobs` 라우트 다음, `*` 라우트 앞):

```tsx
                  <Route path="/league-configs" element={<LeagueConfigList />} />
```

- [ ] **Step 4: 빌드 검증**

Run: `npm run build`
Expected: `tsc` 에러 없이 통과.

- [ ] **Step 5: 수동 렌더 확인**

Run: `npm run dev` → 브라우저 `http://localhost:5173/league-configs`
Expected:
- 사이드바에 "리그 설정" 메뉴 표시, 선택 하이라이트 동작.
- 백엔드 없으므로 테이블은 로딩 후 빈 상태("데이터가 없습니다") 또는 에러 — 크래시 없이 렌더되면 통과.
- (백엔드 구현 후 실제 토글 검증은 별도 세션.)

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/switch.tsx src/pages/league-configs/ src/App.tsx
git commit -m "feat: 리그 설정 관리 화면 (/league-configs)

리그별 라이브 수집·디스코드 알림·경기 동기화 토글.
토글 즉시 PUT, 실패 시 토스트. 백엔드 API는 별도 구현 예정.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
