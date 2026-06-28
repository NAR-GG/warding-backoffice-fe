import { Link } from "react-router";
import { Typography } from "antd";

// 사이드바 로고. Refine 기본 타이틀 대체.
export const Title = ({ collapsed }: { collapsed: boolean }) => (
  <Link
    to="/"
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "12px 8px",
    }}
  >
    <Typography.Title level={4} style={{ margin: 0, whiteSpace: "nowrap" }}>
      {collapsed ? "W" : "Warding"}
    </Typography.Title>
  </Link>
);
