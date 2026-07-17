import type { DataProvider } from "@refinedev/core";
import { API_URL } from "./constants";
import { getToken } from "./auth";

// Spring Boot REST + Pageable 어댑터 (조회 + update/delete, create만 차단).
// 목록: GET /api/admin/{resource}?page=0&size=20&sort=field,asc → Spring Page { content, totalElements }
// cron 처럼 페이징 없는 배열 응답도 그대로 흡수.
// ponytail: 조회 + update/delete 구현. create만 차단.

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

export const dataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  getList: async ({ resource, pagination, sorters, filters }) => {
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

  getOne: async ({ resource, id }) => ({
    data: await http(`/api/admin/${resource}/${id}`),
  }),

  getMany: async ({ resource, ids }) => ({
    data: await Promise.all(ids.map((id) => http(`/api/admin/${resource}/${id}`))),
  }),

  create: () => Promise.reject(new Error("백오피스에서 생성은 지원하지 않습니다")),
  update: async ({ resource, id, variables }) => ({
    data: await http(`/api/admin/${resource}/${id}`, undefined, {
      method: "PUT",
      body: variables,
    }),
  }),
  deleteOne: async ({ resource, id }) => {
    await http(`/api/admin/${resource}/${id}`, undefined, { method: "DELETE", body: undefined });
    return { data: { id } as never };
  },
};
