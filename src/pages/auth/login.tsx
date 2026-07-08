import { useLogin } from "@refinedev/core";
import { Button } from "@/components/ui/button";

export const Login = () => {
  const { mutate: login } = useLogin();
  // 백엔드가 비ADMIN/미등록 거부 시 /login?error= 로 돌려보냄
  const rejected = new URLSearchParams(window.location.search).has("error");

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">NAR 백오피스</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          관리자 계정으로 로그인하세요
        </p>
        {rejected && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-left text-sm text-destructive">
            <p className="font-medium">로그인 실패</p>
            <p>관리자 권한이 있는 계정만 접근할 수 있습니다.</p>
          </div>
        )}
        <Button className="mt-6 w-full" size="lg" onClick={() => login({})}>
          Google 로그인
        </Button>
      </div>
    </div>
  );
};
