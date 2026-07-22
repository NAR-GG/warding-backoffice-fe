import { useTable } from "@refinedev/core";
import { useNavigate } from "react-router";
import { DataTable, type Column } from "@/components/data-table";
import { resolveImageUrl } from "../players/edit-dialogs";

// 구독 가능한 선수 + 구독자 수(백엔드에서 인기순 정렬 고정).
export type SubscribablePlayer = {
  id: number;
  playerName: string;
  imageUrl: string | null;
  role: string | null;
  teamId: number | null;
  teamName: string | null;
  riotId: string | null;
  platform: string | null;
  subscriberCount: number;
};

export const SubscriptionList = () => {
  const navigate = useNavigate();
  // 정렬은 서버 고정(구독자 수 desc)이라 sorters 미지정.
  const { result, tableQuery, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<SubscribablePlayer>({
      resource: "subscriptions/players",
      pagination: { pageSize: 20 },
    });

  const columns: Column<SubscribablePlayer>[] = [
    {
      key: "imageUrl",
      title: "이미지",
      render: (row) =>
        row.imageUrl ? (
          <img
            src={resolveImageUrl(row.imageUrl) ?? undefined}
            alt={row.playerName}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <span className="size-8 rounded-full bg-muted inline-block" />
        ),
    },
    { key: "playerName", title: "선수명" },
    { key: "teamName", title: "소속팀", render: (row) => row.teamName ?? "-" },
    { key: "role", title: "포지션", render: (row) => row.role ?? "-" },
    {
      key: "riotId",
      title: "솔랭 계정",
      render: (row) =>
        row.riotId ? (
          <span className="whitespace-nowrap text-sm">
            {row.riotId}
            {row.platform && (
              <span className="ml-1 text-muted-foreground">({row.platform})</span>
            )}
          </span>
        ) : (
          "-"
        ),
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
      <p className="text-sm text-muted-foreground">
        구독 가능한 선수 목록(구독자 많은 순). 선수를 클릭하면 구독한 사용자를 볼 수 있습니다.
      </p>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }], "merge")}
        searchPlaceholder="선수명 검색"
        onRowClick={(row) =>
          // 이름을 쿼리로 전달 → 새로고침·직접 접근에도 유지(navigation state는 소실됨).
          navigate(`/subscriptions/${row.id}?name=${encodeURIComponent(row.playerName)}`)
        }
      />
    </section>
  );
};
