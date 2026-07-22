import { useTable } from "@refinedev/core";
import { Link, useParams, useSearchParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";

// 특정 선수를 구독한 회원 목록.
export type Subscriber = {
  id: number; // memberId
  nickname: string;
  email: string | null;
  subscribedAt: string;
};

export const SubscriptionDetail = () => {
  const { playerId } = useParams();
  const [searchParams] = useSearchParams();
  const playerName = searchParams.get("name") ?? undefined;

  const { result, tableQuery, currentPage, setCurrentPage, pageCount } = useTable<Subscriber>({
    resource: `subscriptions/players/${playerId}/subscribers`,
    pagination: { pageSize: 20 },
  });

  const columns: Column<Subscriber>[] = [
    { key: "id", title: "회원 ID" },
    { key: "nickname", title: "닉네임" },
    { key: "email", title: "이메일", render: (row) => row.email ?? "-" },
    {
      key: "subscribedAt",
      title: "구독일",
      render: (row) =>
        row.subscribedAt ? new Date(row.subscribedAt).toLocaleString("ko-KR") : "-",
    },
  ];

  const total = result?.total ?? 0;

  return (
    <section className="space-y-4">
      <Link
        to="/subscriptions"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        구독 목록으로
      </Link>
      <h1 className="text-2xl font-semibold">
        {playerName ?? `선수 #${playerId}`} 구독자
        <span className="ml-2 text-base font-normal text-muted-foreground">{total}명</span>
      </h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        pagination={{ currentPage, pageCount, setCurrentPage }}
      />
    </section>
  );
};
