import { useContext } from "react";
import { Link } from "react-router";
import { Typography } from "antd";
import { ColorModeContext } from "../contexts/color-mode";

// 사이드바 로고. 테마에 따라 흰색/검은색 워드마크 스왑. 접히면 "W".
export const Title = ({ collapsed }: { collapsed: boolean }) => {
  const { mode } = useContext(ColorModeContext);
  const logo = mode === "dark" ? "/warding.svg" : "/warding-dark.svg";
  return (
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
        <img src={logo} alt="Warding" style={{ height: 28, width: "auto" }} />
      )}
    </Link>
  );
};
