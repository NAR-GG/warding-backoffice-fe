import type { AuthProvider } from "@refinedev/core";
import { API_URL } from "./constants";

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

// JWT exp 검사. 만료/형식이상이면 false → 존재만 보던 기존 check 의 구멍(만료 토큰으로 빈 화면 유지)을 막는다.
const isTokenValid = (token: string): boolean => {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

const clearTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
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
    const token = getToken();
    if (token && isTokenValid(token)) return { authenticated: true };
    // 없음/만료/무효 → 토큰 정리 후 로그인으로. API 호출 전에 게이트에서 걸러짐.
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
