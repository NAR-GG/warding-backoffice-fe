import { NavLink } from "react-router";

// 구독 페이지 상단 선수/팀 전환 탭. URL 기반이라 상태 없음.
const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  }`;

export const SubscriptionTabs = () => (
  <nav className="inline-flex gap-1 rounded-lg bg-muted p-1">
    <NavLink to="/subscriptions/players" className={tabClass}>
      선수
    </NavLink>
    <NavLink to="/subscriptions/teams" className={tabClass}>
      팀
    </NavLink>
  </nav>
);
