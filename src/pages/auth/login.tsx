import { useLogin } from "@refinedev/core";
import { Alert, Button, Card, Typography } from "antd";

export const Login = () => {
  const { mutate: login } = useLogin();
  // 백엔드가 비ADMIN/미등록 거부 시 /login?error= 로 돌려보냄
  const rejected = new URLSearchParams(window.location.search).has("error");
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <Card style={{ width: 360, textAlign: "center" }}>
        <Typography.Title level={3}>NAR 백오피스</Typography.Title>
        <Typography.Paragraph type="secondary">관리자 계정으로 로그인하세요</Typography.Paragraph>
        {rejected && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16, textAlign: "left" }}
            message="로그인 실패"
            description="관리자 권한이 있는 계정만 접근할 수 있습니다."
          />
        )}
        <Button type="primary" block size="large" onClick={() => login({})}>
          Google 로그인
        </Button>
      </Card>
    </div>
  );
};
