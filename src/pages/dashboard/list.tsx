import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { NotificationChart, Sparkline, SubscriptionChart } from "./charts";
import { SignupChart } from "./signup-chart";
import { useDashboardStats, type RankRow } from "./stats";

const RANGES = [1, 7, 30] as const;
type Range = (typeof RANGES)[number];

const num = (n: number) => n.toLocaleString("ko-KR");
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// APM 대시보드 밀도: 기본 Card(py-6/px-6/gap-6)는 여백이 커서 한 화면에 몇 장 못 올린다.
function Panel({
  title,
  desc,
  className,
  children,
}: {
  title: string;
  desc?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("gap-2 rounded-md py-2.5 shadow-none", className)}>
      <CardHeader className="gap-0 px-3">
        <CardTitle className="text-[13px] font-medium">{title}</CardTitle>
        {desc && <CardDescription className="text-[11px]">{desc}</CardDescription>}
      </CardHeader>
      <CardContent className="px-3">{children}</CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  delta,
  positive = true,
  spark,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  spark: number[];
}) {
  return (
    <Card className="gap-1 rounded-md py-2.5 shadow-none">
      <CardHeader className="gap-0 px-3">
        <CardDescription className="text-[11px]">{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 px-3">
        <p className={cn("text-[11px] font-medium", positive ? "text-emerald-600" : "text-destructive")}>
          {positive ? "▲" : "▼"} {delta}
        </p>
        <Sparkline values={spark} />
      </CardContent>
    </Card>
  );
}

function RankList({ rows, showShare = false }: { rows: RankRow[]; showShare?: boolean }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">데이터가 없습니다</p>;
  }
  const max = Math.max(...rows.map((r) => r.count));
  const total = sum(rows.map((r) => r.count));
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.name} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
          <span className="truncate text-xs">{row.name}</span>
          <Progress value={(row.count / max) * 100} className="h-1.5" />
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {num(row.count)}
            {showShare && ` · ${Math.round((row.count / total) * 100)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

export const Dashboard = () => {
  const [range, setRange] = useState<Range>(7);
  const {
    isLoading,
    isError,
    hourly,
    compareLabel,
    signupRows,
    subs,
    pushes,
    funnel,
    totalMembers,
    onboardRate,
    leagues,
    teams,
    players,
  } = useDashboardStats(range);

  const newMembers = sum(signupRows.map((r) => r.count));
  const prevMembers = sum(signupRows.map((r) => r.prev ?? 0)) || 1;
  const growth = ((newMembers - prevMembers) / prevMembers) * 100;
  const newSubs = sum(subs.map((d) => d.player + d.team + d.match));
  const periodLabel = hourly ? "24시간" : `${range}일`;

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold">대시보드</h1>
          {isLoading && <span className="text-[11px] text-muted-foreground">불러오는 중…</span>}
          {isError && <span className="text-[11px] text-destructive">집계를 불러오지 못했습니다</span>}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button
              key={r}
              variant={r === range ? "default" : "outline"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setRange(r)}
            >
              {r === 1 ? "24시간" : `${r}일`}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="총 가입자"
          value={num(totalMembers)}
          delta={`${num(newMembers)}명 신규 (${periodLabel})`}
          spark={signupRows.map((r) => r.count)}
        />
        <StatCard
          label={`신규 가입 · ${periodLabel}`}
          value={num(newMembers)}
          delta={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% ${compareLabel} 대비`}
          positive={growth >= 0}
          spark={signupRows.map((r) => r.count)}
        />
        <StatCard
          label="온보딩 완료율"
          value={`${onboardRate.toFixed(1)}%`}
          delta={`가입 ${num(totalMembers)}명 중 ${num(funnel[1].count)}명`}
          spark={signupRows.map((r) => r.count)}
        />
        <StatCard
          label={`신규 구독 · ${periodLabel}`}
          value={num(newSubs)}
          delta="선수·팀·경기 합계"
          spark={subs.map((d) => d.player + d.team + d.match)}
        />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-3">
        <Panel
          title={hourly ? "시간대별 신규 가입" : "일별 신규 가입"}
          desc={
            hourly
              ? "직전 24시간 · 회색 = 그 전 24시간"
              : "회색 = 직전 기간 · 호버 시 그 날 피크 시간대"
          }
          className="lg:col-span-2"
        >
          <SignupChart rows={signupRows} compareLabel={compareLabel} />
        </Panel>

        <Panel title="온보딩 퍼널" desc="가입 → 온보딩 → 구독 → 평점">
          <div className="space-y-2">
            {funnel.map((step, i) => (
              <div key={step.name} className="space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span>{step.name}</span>
                  <span className="tabular-nums">
                    {num(step.count)}
                    {i > 0 && funnel[i - 1].count > 0 && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">
                        {Math.round((step.count / funnel[i - 1].count) * 100)}%
                      </span>
                    )}
                  </span>
                </div>
                <Progress
                  value={funnel[0].count > 0 ? (step.count / funnel[0].count) * 100 : 0}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Panel
          title="알림 구독 추이"
          desc={hourly ? "직전 24시간 · 유형별 신규 구독" : "유형별 신규 구독 · 경기일에 집중"}
        >
          <SubscriptionChart data={subs} />
        </Panel>
        <Panel title={hourly ? "시간대별 알림 발송" : "일별 알림 발송"} desc="인앱 알림 생성 건수">
          <NotificationChart data={pushes} />
        </Panel>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-3">
        <Panel title="관심 리그" desc="가입자 관심 리그 분포">
          <RankList rows={leagues} showShare />
        </Panel>
        <Panel title="팀 구독 TOP 10" desc="팀 알림 구독자 수">
          <RankList rows={teams} />
        </Panel>
        <Panel title="선수 구독 TOP 10" desc="선수 알림 구독자 수">
          <RankList rows={players} />
        </Panel>
      </div>
    </section>
  );
};
