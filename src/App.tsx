import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import routerProvider, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { Layout } from "./components/layout";
import { ThemeProvider } from "./components/theme-provider";
import { Login, OAuthCallback } from "./pages/auth";
import { MemberList } from "./pages/members";
import { PlayerList } from "./pages/players";
import { TeamList } from "./pages/teams";
import { CronJobList } from "./pages/cron-jobs";
import { ErrorPage } from "./pages/error";
import { authProvider } from "./providers/auth";
import { dataProvider } from "./providers/data";
import { notificationProvider } from "./providers/notification";

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ThemeProvider>
          <DevtoolsProvider>
            <Refine
              authProvider={authProvider}
              notificationProvider={notificationProvider}
              routerProvider={routerProvider}
              dataProvider={dataProvider}
              resources={[
                { name: "members", list: "/members", meta: { label: "가입자" } },
                { name: "players", list: "/players", meta: { label: "선수" } },
                { name: "teams", list: "/teams", meta: { label: "팀" } },
                { name: "cron-jobs", list: "/cron-jobs", meta: { label: "Cron 작업" } },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                projectId: "VTPu3S-fBHoy4-QlVKGC",
              }}
            >
              <Routes>
                {/* OAuth 콜백: 토큰 받기 전이라 인증 밖 */}
                <Route path="/oauth/callback" element={<OAuthCallback />} />

                {/* 인증 필요 영역 */}
                <Route
                  element={
                    <Authenticated
                      key="authenticated-routes"
                      fallback={<CatchAllNavigate to="/login" />}
                    >
                      <Layout />
                    </Authenticated>
                  }
                >
                  <Route index element={<NavigateToResource resource="members" />} />
                  <Route path="/members" element={<MemberList />} />
                  <Route path="/players" element={<PlayerList />} />
                  <Route path="/teams" element={<TeamList />} />
                  <Route path="/cron-jobs" element={<CronJobList />} />
                  <Route path="*" element={<ErrorPage />} />
                </Route>

                {/* 로그인: 이미 인증됐으면 홈으로 */}
                <Route
                  element={
                    <Authenticated key="auth-pages" fallback={<Outlet />}>
                      <NavigateToResource resource="members" />
                    </Authenticated>
                  }
                >
                  <Route path="/login" element={<Login />} />
                </Route>
              </Routes>

              <RefineKbar />
              <Toaster />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
            <DevtoolsPanel />
          </DevtoolsProvider>
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
