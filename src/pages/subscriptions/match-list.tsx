import { useTable } from "@refinedev/core";
import { useNavigate } from "react-router";
import { DataTable, type Column } from "@/components/data-table";
import { SubscriptionTabs } from "./tabs";

// 구독자가 1명 이상인 경기 + 구독자 수(백엔드에서 인기순 정렬 고정).
export type SubscribedMatch = {
  id: string; // league_match.id (VARCHAR)
  leagueName: string;
  matchTitle: string | null;
  blueTeamName: string | null;
  redTeamName: string | null;
  state: string | null;
  matchDate: string | null; // 서버가 KST 로 변환해 내려줌
  subscriberCount: number;
};

// 업스트림 state 값을 한국어로. 모르는 값은 원문 노출.
const STATE_LABEL: Record<string, string> = {
  unstarted: "예정",
  inProgress: "진행 중",
  completed: "종료",
};

export const MatchSubscriptionList = () => {
  const navigate = useNavigate();
  // 정렬은 서버 고정(구독자 수 desc)이라 sorters 미지정.
  const { result, tableQuery, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<SubscribedMatch>({
      resource: "subscriptions/matches",
      pagination: { pageSize: 20 },
    });

  const columns: Column<SubscribedMatch>[] = [
    {
      key: "matchDate",
      title: "일시",
      render: (row) =>
        row.matchDate ? (
          <span className="whitespace-nowrap text-sm">
            {new Date(row.matchDate).toLocaleString("ko-KR")}
          </span>
        ) : (
          "-"
        ),
    },
    { key: "leagueName", title: "리그" },
    {
      key: "teams",
      title: "대진",
      render: (row) => `${row.blueTeamName ?? "?"} vs ${row.redTeamName ?? "?"}`,
    },
    { key: "matchTitle", title: "경기명", render: (row) => row.matchTitle ?? "-" },
    {
      key: "state",
      title: "상태",
      render: (row) => (row.state ? (STATE_LABEL[row.state] ?? row.state) : "-"),
    },
    {
      key: "subscriberCount",
      title: "구독자 수",
      render: (row) => <span className="font-medium tabular-nums">{row.subscriberCount}</span>,
    },
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">구독</h1>
      <SubscriptionTabs />
      <p className="text-sm text-muted-foreground">
        예약 알림 구독자가 있는 경기 목록(구독자 많은 순). 경기를 클릭하면 구독한 사용자를 볼 수
        있습니다.
      </p>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }], "merge")}
        searchPlaceholder="경기명·팀명 검색"
        onRowClick={(row) =>
          // 대진명을 쿼리로 전달 → 새로고침·직접 접근에도 유지(navigation state는 소실됨).
          navigate(
            `/subscriptions/matches/${row.id}?name=${encodeURIComponent(
              `${row.blueTeamName ?? "?"} vs ${row.redTeamName ?? "?"}`
            )}`
          )
        }
      />
    </section>
  );
};
