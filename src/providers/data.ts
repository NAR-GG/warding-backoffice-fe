import type { DataProvider } from "@refinedev/core";
import { API_URL } from "./constants";
import { getToken } from "./auth";

// Spring Boot REST + Pageable 어댑터 (조회 전용).
// 목록: GET /api/admin/{resource}?page=0&size=20&sort=field,asc → Spring Page { content, totalElements }
// cron 처럼 페이징 없는 배열 응답도 그대로 흡수.
// ponytail: 조회만 구현. 쓰기(create/update/delete) 필요해지면 그때 추가.

const http = async (path: string, search?: URLSearchParams) => {
  const url = `${API_URL}${path}${search && [...search].length ? `?${search}` : ""}`;
  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    // refine onError 가 statusCode 로 401 판별 → 로그아웃 처리
    throw Object.assign(new Error(`${res.status} ${res.statusText} — ${url}`), {
      statusCode: res.status,
    });
  }
  return res.json();
};

export const dataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  getList: async ({ resource, pagination, sorters }) => {
    const { currentPage = 1, pageSize = 20, mode } = pagination ?? {};
    const params = new URLSearchParams();
    if (mode !== "off") {
      params.set("page", String(currentPage - 1)); // Spring page는 0-base
      params.set("size", String(pageSize));
    }
    // Spring 다중 정렬: sort 파라미터 반복
    sorters?.forEach((s) => params.append("sort", `${s.field},${s.order}`));

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

  create: () => Promise.reject(new Error("백오피스는 조회 전용입니다")),
  update: () => Promise.reject(new Error("백오피스는 조회 전용입니다")),
  deleteOne: () => Promise.reject(new Error("백오피스는 조회 전용입니다")),
};
