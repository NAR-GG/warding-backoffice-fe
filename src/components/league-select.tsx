import { useList } from "@refinedev/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 리그 필터 드롭다운. 옵션은 GET /api/admin/leagues (실데이터 distinct 문자열 배열).
// 선택 없음("전체")은 빈 문자열로 넘겨 상위에서 필터 해제 처리.
export function LeagueSelect({ onChange }: { onChange: (league: string) => void }) {
  const { result } = useList({ resource: "leagues", pagination: { mode: "off" } });
  const leagues = (result?.data ?? []) as unknown as string[];

  return (
    <Select defaultValue="ALL" onValueChange={(v) => onChange(v === "ALL" ? "" : v)}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="리그 전체" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">리그 전체</SelectItem>
        {leagues.map((l) => (
          <SelectItem key={l} value={l}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
