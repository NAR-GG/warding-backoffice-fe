import { useCustom } from "@refinedev/core";
import { NavLink } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 응원 탭 공통 머리: 제목 + 회원/선수 탭 + 기간 선택 + 요약 카드 4장.
 * 응원 = 홈 솔랭 카드의 응원 버튼(솔랭 중인 선수에게만 누를 수 있다).
 * GET /api/admin/cheers/summary?days=N (days 없으면 전체 기간)
 */
type Summary = { totalCount: number; memberCount: number; playerCount: number; gameCount: number };

// 기간 필터 값. "" = 전체(dataProvider 가 빈 값은 파라미터에서 뺀다).
const PERIODS = [
  { value: "", label: "전체 기간" },
  { value: "1", label: "최근 24시간" },
  { value: "7", label: "최근 7일" },
  { value: "30", label: "최근 30일" },
];
// Radix Select 는 빈 문자열 value 를 못 쓴다 → 화면에서만 "all" 로 바꿔 끼운다.
const ALL = "all";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  }`;

export const CheerHeader = ({
  days,
  onDaysChange,
}: {
  days: string;
  onDaysChange: (days: string) => void;
}) => {
  const { result, query } = useCustom<Summary>({
    url: "/api/admin/cheers/summary",
    method: "get",
    config: { query: days ? { days } : {} },
  });
  const s = result?.data;
  const stat = (n?: number) => (query.isLoading || n == null ? "…" : n.toLocaleString("ko-KR"));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">응원</h1>
      <div className="flex flex-wrap items-center gap-3">
        <nav className="inline-flex gap-1 rounded-lg bg-muted p-1">
          <NavLink to="/cheers/members" className={tabClass}>
            회원 랭킹
          </NavLink>
          <NavLink to="/cheers/players" className={tabClass}>
            선수 랭킹
          </NavLink>
        </nav>
        <Select value={days || ALL} onValueChange={(v) => onDaysChange(v === ALL ? "" : v)}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value || ALL} value={p.value || ALL}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="총 응원 수" value={stat(s?.totalCount)} />
        <Stat label="응원한 회원" value={stat(s?.memberCount)} />
        <Stat label="응원받은 선수" value={stat(s?.playerCount)} />
        <Stat label="응원이 달린 판" value={stat(s?.gameCount)} />
      </div>
      <p className="text-xs text-muted-foreground">
        기간은 그 판에 마지막으로 누른 시각 기준이라, 기간 경계에 걸친 판은 그 판 응원 전체가 들어갑니다.
      </p>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 py-3 shadow-none">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
