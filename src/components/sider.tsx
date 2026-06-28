import { ThemedSider } from "@refinedev/antd";
import { useMenu } from "@refinedev/core";
import { Menu } from "antd";
import type { ComponentProps } from "react";
import { Title } from "./title";

// 기본 ThemedSider + 로고(Warding) + 로그아웃 하단 고정.
// render 로 메뉴를 직접 그리되 antd <Menu> 로 감싸 기본 들여쓰기/패딩/선택 하이라이트 유지.
export const Sider = (props: ComponentProps<typeof ThemedSider>) => {
  const { selectedKey } = useMenu();
  return (
    <ThemedSider
      {...props}
      fixed
      Title={({ collapsed }) => <Title collapsed={collapsed} />}
      render={({ items, logout, collapsed }) => (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ flex: 1, border: "none", background: "transparent" }}
            inlineCollapsed={collapsed}
          >
            {items}
          </Menu>
          <Menu
            mode="inline"
            selectable={false}
            style={{ border: "none", background: "transparent" }}
            inlineCollapsed={collapsed}
          >
            {logout}
          </Menu>
        </div>
      )}
    />
  );
};
