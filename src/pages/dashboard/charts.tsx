import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PushPoint, SubsPoint } from "./stats";

// 색은 index.css 의 --chart-* 토큰을 직접 참조한다(다크모드 값까지 토큰이 들고 있음).
const subsConfig = {
  player: { label: "선수" },
  team: { label: "팀" },
  match: { label: "경기" },
} satisfies ChartConfig;

const pushConfig = { count: { label: "발송" } } satisfies ChartConfig;

// APM 대시보드처럼 축은 10px, 그리드는 점선 hairline 으로 눌러둔다.
const axisTick = { fontSize: 10 } as const;

export function SubscriptionChart({ data }: { data: SubsPoint[] }) {
  return (
    <ChartContainer config={subsConfig} className="aspect-auto h-[168px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="2 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={24} tick={axisTick} />
        <YAxis tickLine={false} axisLine={false} width={40} tick={axisTick} />
        <ChartTooltip isAnimationActive={false} animationDuration={0} content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent className="pt-1 text-[11px]" />} />
        <Area dataKey="player" stackId="s" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.7} strokeWidth={1.5} />
        <Area dataKey="team" stackId="s" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.7} strokeWidth={1.5} />
        <Area dataKey="match" stackId="s" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.7} strokeWidth={1.5} />
      </AreaChart>
    </ChartContainer>
  );
}

export function NotificationChart({ data }: { data: PushPoint[] }) {
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a), data[0]);
  return (
    <ChartContainer config={pushConfig} className="aspect-auto h-[168px] w-full">
      <BarChart data={data} margin={{ top: 14, right: 10, bottom: 0, left: -10 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={24} tick={axisTick} />
        <YAxis tickLine={false} axisLine={false} width={48} tick={axisTick} />
        <ChartTooltip isAnimationActive={false} animationDuration={0} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="count" fill="var(--chart-4)" radius={[2, 2, 0, 0]} />
        <ReferenceDot
          x={peak.label}
          y={peak.count}
          r={0}
          label={{
            value: peak.count.toLocaleString("ko-KR"),
            position: "top",
            fontSize: 10,
            fill: "var(--foreground)",
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}

const sparkConfig = { value: { label: "" } } satisfies ChartConfig;

export function Sparkline({ values }: { values: number[] }) {
  const data = values.map((value, i) => ({ i, value }));
  return (
    <ChartContainer config={sparkConfig} className="aspect-auto h-7 w-full">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area
          dataKey="value"
          stroke="var(--chart-1)"
          fill="var(--chart-1)"
          fillOpacity={0.12}
          strokeWidth={1.25}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
