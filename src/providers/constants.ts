// API 베이스 URL. 로컬 개발은 localhost:8080, 배포는 VITE_API_URL 로 주입.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
