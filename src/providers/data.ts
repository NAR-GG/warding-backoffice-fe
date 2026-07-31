import type { DataProvider } from "@refinedev/core";
import { API_URL } from "./constants";
import { getToken } from "./auth";

// Spring Boot REST + Pageable 어댑터 (전체 CRUD).
// 목록: GET /api/admin/{resource}?page=0&size=20&sort=field,asc → Spring Page { content, totalElements }
// cron 처럼 페이징 없는 배열 응답도 그대로 흡수.

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
    // 백엔드 예외 핸들러는 { message } JSON을 준다(409/404/400). 없으면 상태줄 사용.
    let message = `${res.status} ${res.statusText} — ${url}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // JSON 아님 — 상태줄 유지
    }
    throw Object.assign(new Error(message), { statusCode: res.status });
  }
  if (res.status === 204) return null; // DELETE 응답
  return res.json();
};

// ── 공지 mock ─────────────────────────────────────────────────────
// ponytail: 공지 백엔드(/api/admin/notices)가 배포되면 이 블록 통째로 삭제.
// 새로고침하면 초기화되는 인메모리 데이터로 목록/작성/수정/삭제 UI만 확인한다.
export const USE_NOTICE_MOCK = false;
const noticeMock = (resource: string) => USE_NOTICE_MOCK && resource === "notices";
let mockNoticeId = 4;
let mockNotices: Record<string, unknown>[] = [
  {
    id: 3,
    title: "[업데이트] 워딩 1.0.5 업데이트 안내",
    content: "안녕하세요, 워딩입니다.\n\n## 개선 사항\n- 선수 평점 집계가 더 정확해졌어요.",
    pinned: true,
    promoteUntil: "2026-08-04",
    publishedAt: "2026-07-28T10:00:00",
    createdAt: "2026-07-28T10:00:00",
  },
  {
    id: 2,
    title: "[반영완료] 선수 추가 요청 반영 완료 안내 (7월 4주차)",
    content: "이번 주에 접수해 주신 선수 추가 요청이 반영되었습니다.",
    pinned: false,
    promoteUntil: null,
    publishedAt: "2026-07-29T14:20:00",
    createdAt: "2026-07-29T14:20:00",
  },
  {
    id: 1,
    title: "커뮤니티 오픈 사전 안내 (초안)",
    content: "커뮤니티 기능을 준비 중입니다.",
    pinned: false,
    promoteUntil: null,
    publishedAt: null,
    createdAt: "2026-07-30T09:00:00",
  },
];
// published 플래그 → publishedAt 변환(서버 동작 모사).
const applyPublished = (values: Record<string, unknown>, prev?: Record<string, unknown>) => {
  const { published, ...rest } = values;
  return {
    ...rest,
    publishedAt: published
      ? (prev?.publishedAt as string | null) ?? new Date().toISOString()
      : null,
  };
};

export const dataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  getList: async ({ resource, pagination, sorters, filters }) => {
    if (noticeMock(resource)) {
      return { data: mockNotices as never[], total: mockNotices.length };
    }
    const { currentPage = 1, pageSize = 20, mode } = pagination ?? {};
    const params = new URLSearchParams();
    if (mode !== "off") {
      params.set("page", String(currentPage - 1)); // Spring page는 0-base
      params.set("size", String(pageSize));
    }
    // Spring 다중 정렬: sort 파라미터 반복
    sorters?.forEach((s) => params.append("sort", `${s.field},${s.order}`));
    // 필터는 field=value 쿼리 파라미터로 그대로 전달 (예: 검색 q). 백엔드가 해석.
    filters?.forEach((f) => {
      if ("field" in f && f.value != null && f.value !== "") {
        params.set(f.field, String(f.value));
      }
    });

    const body = await http(`/api/admin/${resource}`, params);
    const data = Array.isArray(body) ? body : body.content ?? [];
    const total = Array.isArray(body) ? body.length : body.totalElements ?? data.length;
    return { data, total };
  },

  getOne: async ({ resource, id }) => {
    if (noticeMock(resource)) {
      const row = mockNotices.find((n) => String(n.id) === String(id));
      if (!row) throw Object.assign(new Error("공지를 찾을 수 없습니다"), { statusCode: 404 });
      return { data: row as never };
    }
    return { data: await http(`/api/admin/${resource}/${id}`) };
  },

  getMany: async ({ resource, ids }) => ({
    data: await Promise.all(ids.map((id) => http(`/api/admin/${resource}/${id}`))),
  }),

  create: async ({ resource, variables }) => {
    if (noticeMock(resource)) {
      const row = {
        id: mockNoticeId++,
        createdAt: new Date().toISOString(),
        ...applyPublished(variables as Record<string, unknown>),
      };
      mockNotices = [row, ...mockNotices];
      return { data: row as never };
    }
    return {
      data: await http(`/api/admin/${resource}`, undefined, {
        method: "POST",
        body: variables,
      }),
    };
  },
  update: async ({ resource, id, variables }) => {
    if (noticeMock(resource)) {
      const prev = mockNotices.find((n) => n.id === id);
      const row = { ...prev, ...applyPublished(variables as Record<string, unknown>, prev) };
      mockNotices = mockNotices.map((n) => (n.id === id ? row : n));
      return { data: row as never };
    }
    return {
      data: await http(`/api/admin/${resource}/${id}`, undefined, {
        method: "PUT",
        body: variables,
      }),
    };
  },
  deleteOne: async ({ resource, id }) => {
    if (noticeMock(resource)) {
      mockNotices = mockNotices.filter((n) => n.id !== id);
      return { data: { id } as never };
    }
    await http(`/api/admin/${resource}/${id}`, undefined, { method: "DELETE", body: undefined });
    return { data: { id } as never };
  },
};
