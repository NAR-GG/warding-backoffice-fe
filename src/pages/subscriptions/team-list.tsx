import { useTable } from "@refinedev/core";
import { useNavigate } from "react-router";
import { DataTable, type Column } from "@/components/data-table";
import { resolveImageUrl } from "../players/edit-dialogs";
import { SubscriptionTabs } from "./tabs";

// 구독 가능한 팀 + 구독자 수(백엔드에서 인기순 정렬 고정).
export type SubscribableTeam = {
  id: number;
  teamName: string;
  teamCode: string | null;
  imageUrl: string | null;
  subscriberCount: number;
};

export const TeamSubscriptionList = () => {
  const navigate = useNavigate();
  // 정렬은 서버 고정(구독자 수 desc)이라 sorters 미지정.
  const { result, tableQuery, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<SubscribableTeam>({
      resource: "subscriptions/teams",
      pagination: { pageSize: 20 },
    });

  const columns: Column<SubscribableTeam>[] = [
    {
      key: "imageUrl",
      title: "이미지",
      render: (row) =>
        row.imageUrl ? (
          <img
            src={resolveImageUrl(row.imageUrl) ?? undefined}
            alt={row.teamName}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <span className="size-8 rounded-full bg-muted inline-block" />
        ),
    },
    { key: "teamName", title: "팀명" },
    { key: "teamCode", title: "코드", render: (row) => row.teamCode ?? "-" },
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
        구독 가능한 팀 목록(구독자 많은 순). 팀을 클릭하면 구독한 사용자를 볼 수 있습니다.
      </p>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }], "merge")}
        searchPlaceholder="팀명 검색"
        onRowClick={(row) =>
          navigate(`/subscriptions/teams/${row.id}?name=${encodeURIComponent(row.teamName)}`)
        }
      />
    </section>
  );
};
