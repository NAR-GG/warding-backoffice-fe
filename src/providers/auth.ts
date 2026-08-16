import type { AuthProvider } from "@refinedev/core";
import { API_URL } from "./constants";

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

const getToken = () => localStorage.getItem(TOKEN_KEY);

// JWT exp(ms). 형식 이상이면 0 → 항상 만료 취급.
// 존재만 보던 기존 check 의 구멍(만료 토큰으로 빈 화면 유지)을 막는다.
const expiresAt = (token: string): number => {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
};

const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};

// access token 은 30분짜리(백엔드 상수, 모바일과 공유). 백오피스 세션은 refresh
// 토큰(14일)으로 이어붙인다 — 30분마다 로그인 튕기는 걸 막으려고.
const REFRESH_MARGIN_MS = 60_000; // 요청 도중 만료되지 않게 1분 미리 갱신
let refreshing: Promise<string | null> | null = null;

const refresh = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const res = await fetch(
      `${API_URL}/api/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
      { method: "POST" }
    );
    if (!res.ok) {
      clearTokens(); // 401 = 리프레시도 만료/무효 → 재로그인
      return null;
    }
    const body = await res.json();
    localStorage.setItem(TOKEN_KEY, body.accessToken);
    if (body.refreshToken) localStorage.setItem(REFRESH_KEY, body.refreshToken);
    return body.accessToken as string;
  } catch {
    return null; // 네트워크 오류는 토큰 유지(다음 요청에서 재시도)
  }
};

/** 유효한 access token. 만료(임박)면 갱신 후 반환. 실패 시 null. */
export const getValidToken = async (): Promise<string | null> => {
  const token = getToken();
  if (token && expiresAt(token) > Date.now() + REFRESH_MARGIN_MS) return token;
  // 동시 요청이 각자 refresh 를 때리면 회전 레이스가 난다 — 하나로 합친다.
  refreshing ??= refresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
};

export const authProvider: AuthProvider = {
  // 구글 OAuth 브라우저 리다이렉트. target=backoffice → 백엔드가 콜백을 백오피스로 보냄.
  login: async () => {
    window.location.href = `${API_URL}/oauth2/authorization/google?target=backoffice`;
    return { success: true };
  },

  logout: async () => {
    clearTokens();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    if (await getValidToken()) return { authenticated: true };
    // 없음/만료/리프레시 실패 → 토큰 정리 후 로그인으로. API 호출 전에 게이트에서 걸러짐.
    clearTokens();
    return { authenticated: false, redirectTo: "/login" };
  },

  onError: async (error) => {
    if (error?.statusCode === 401 || error?.status === 401) {
      return { logout: true, redirectTo: "/login", error };
    }
    return {};
  },
};
