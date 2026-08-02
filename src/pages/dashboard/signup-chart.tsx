import { Bar, CartesianGrid, ComposedChart, Line, ReferenceDot, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

const config = {
  count: { label: "신규 가입" },
  prev: { label: "직전 기간" },
} satisfies ChartConfig;

// 일별/시간별 공용 행. title = 툴팁 제목, hint = 그 아래 보조 한 줄(일별일 때 피크 시간대).
export type SignupRow = {
  label: string;
  title: string;
  count: number;
  prev: number | null;
  hint?: string;
};

function SignupTooltip({ row, compareLabel }: { row: SignupRow; compareLabel: string }) {
  return (
    <div className="grid min-w-[10rem] gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{row.title}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">신규 가입</span>
        <span className="font-mono font-medium tabular-nums">{row.count}</span>
      </div>
      {row.prev != null && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{compareLabel}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{row.prev}</span>
        </div>
      )}
      {row.hint && <p className="border-t pt-1 text-[11px] text-muted-foreground">{row.hint}</p>}
    </div>
  );
}

export function SignupChart({ rows, compareLabel }: { rows: SignupRow[]; compareLabel: string }) {
  const peak = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]);

  return (
    <ChartContainer config={config} className="aspect-auto h-[168px] w-full">
      {/* 카운트 계열이라 막대. 선/영역으로 그리면 점 사이 보간이 "없는 값"을 있는 것처럼 보이게 한다. */}
      <ComposedChart data={rows} margin={{ top: 14, right: 10, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={24} tick={{ fontSize: 10 }} />
        <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 10 }} />
        {/* 애니메이션 끔 — 켜두면 툴팁이 왼쪽에서 미끄러져 들어온다 */}
        <ChartTooltip
          cursor={{ fillOpacity: 0.5 }}
          isAnimationActive={false}
          animationDuration={0}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <SignupTooltip row={payload[0].payload as SignupRow} compareLabel={compareLabel} />
            ) : null
          }
        />
        <Bar dataKey="count" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
        {/* 비교 구간은 값 자체보다 "지난번보다 위냐 아래냐"를 보는 용도라 선으로 겹친다. */}
        <Line
          dataKey="prev"
          stroke="var(--muted-foreground)"
          strokeOpacity={0.6}
          strokeWidth={1}
          strokeDasharray="3 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        {/* 최대값만 숫자로 찍는다 — 전 포인트 라벨링은 금지 */}
        <ReferenceDot
          x={peak.label}
          y={peak.count}
          r={2.5}
          fill="var(--chart-1)"
          stroke="var(--background)"
          label={{ value: `${peak.count}`, position: "top", fontSize: 10, fill: "var(--foreground)" }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
