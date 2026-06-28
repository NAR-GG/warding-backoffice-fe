import type { AuthProvider } from "@refinedev/core";
import { API_URL } from "./constants";

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const authProvider: AuthProvider = {
  // 구글 OAuth 브라우저 리다이렉트. target=backoffice → 백엔드가 콜백을 백오피스로 보냄.
  login: async () => {
    window.location.href = `${API_URL}/oauth2/authorization/google?target=backoffice`;
    return { success: true };
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () =>
    getToken()
      ? { authenticated: true }
      : { authenticated: false, redirectTo: "/login" },

  onError: async (error) => {
    if (error?.statusCode === 401 || error?.status === 401) {
      return { logout: true, redirectTo: "/login", error };
    }
    return {};
  },
};
