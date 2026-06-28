import { useEffect } from "react";
import { useNavigate } from "react-router";

// 백엔드 OAuth 성공 → /oauth/callback?accessToken=...&refreshToken=... 로 리다이렉트됨.
// 토큰 저장 후 홈으로.
export const OAuthCallback = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    if (accessToken) {
      localStorage.setItem("accessToken", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      navigate("/", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [navigate]);
  return <div style={{ padding: 24 }}>로그인 처리 중…</div>;
};
