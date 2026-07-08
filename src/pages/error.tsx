import { Link } from "react-router";
import { Button } from "@/components/ui/button";

// @refinedev/antd ErrorComponent 대체.
export const ErrorPage = () => (
  <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
    <p className="text-6xl font-bold text-muted-foreground">404</p>
    <p className="text-muted-foreground">페이지를 찾을 수 없습니다.</p>
    <Button asChild>
      <Link to="/">홈으로</Link>
    </Button>
  </div>
);
