import { Link } from "react-router";
import { Typography } from "antd";

// 사이드바 로고. warding.svg(흰색 워드마크) 사용. 접히면 "W".
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
    {collapsed ? (
      <Typography.Title level={4} style={{ margin: 0 }}>
        W
      </Typography.Title>
    ) : (
      <img src="/warding.svg" alt="Warding" style={{ height: 28, width: "auto" }} />
    )}
  </Link>
);
