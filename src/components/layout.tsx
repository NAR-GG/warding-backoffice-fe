import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router";
import { useGetIdentity, useLogout, useMenu } from "@refinedev/core";
import { LogOut, Moon, PanelLeft, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type Identity = { id: number; name?: string; avatar?: string };

// @refinedev/antd ThemedLayout + 커스텀 Sider/Header/Title 대체.
export function Layout() {
  const { menuItems, selectedKey } = useMenu();
  const { mutate: logout } = useLogout();
  const { data: user } = useGetIdentity<Identity>();
  const { mode, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Cmd/Ctrl+B로 사이드바 토글
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 다크모드=흰 워드마크, 라이트=검은 워드마크 (원본 title.tsx 규칙 유지)
  const logo = mode === "dark" ? "/warding.svg" : "/warding-dark.svg";

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar text-sidebar-foreground overflow-hidden transition-[width] duration-200",
          sidebarOpen ? "w-56" : "w-0 border-r-0"
        )}
      >
        <Link to="/" className="flex h-16 items-center justify-center border-b">
          <img src={logo} alt="Warding" className="h-7 w-auto" />
        </Link>
        <nav className="flex-1 space-y-1 p-3">
          {menuItems.map((item) => {
            const active = item.key === selectedKey;
            return (
              <Link
                key={item.key}
                to={item.route ?? "/"}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                {item.label ?? item.name}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70"
            onClick={() => logout()}
          >
            <LogOut className="mr-2 size-4" />
            로그아웃
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-4 border-b px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="사이드바 토글 (⌘B)"
            title="사이드바 토글 (⌘B)"
          >
            <PanelLeft className="size-4" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="테마 전환">
            {mode === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {user?.name && <span className="text-sm font-medium">{user.name}</span>}
          {user?.avatar && (
            <img
              src={user.avatar}
              alt={user.name}
              className="size-8 rounded-full"
            />
          )}
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
