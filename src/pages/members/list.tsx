import { useTable } from "@refinedev/core";
import { useNavigate } from "react-router";
import { DataTable, type Column } from "@/components/data-table";
import { DeleteRowButton } from "@/components/delete-row-button";

type Member = {
  id: number;
  name: string;
  email: string;
  favoriteLeagueName: string;
  // 구독 수는 백엔드 집계. 미배포 구간에는 undefined → "-"
  favoritePlayerCount?: number;
  favoriteTeamCount?: number;
  createdAt: string;
};

const count = (n?: number) =>
  n == null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className={n === 0 ? "text-muted-foreground tabular-nums" : "tabular-nums"}>{n}</span>
  );

const columns: Column<Member>[] = [
  { key: "id", title: "ID", sortable: true },
  { key: "name", title: "이름" },
  { key: "email", title: "이메일" },
  { key: "favoriteLeagueName", title: "관심 리그" },
  {
    key: "favoritePlayerCount",
    title: "선수 구독",
    sortable: true,
    render: (row) => count(row.favoritePlayerCount),
  },
  {
    key: "favoriteTeamCount",
    title: "팀 구독",
    sortable: true,
    render: (row) => count(row.favoriteTeamCount),
  },
  { key: "createdAt", title: "가입일", sortable: true },
  {
    key: "actions",
    title: "관리",
    // 행 클릭(상세 이동)과 겹치므로 버블링 차단.
    render: (row) => (
      <span onClick={(e) => e.stopPropagation()}>
        <DeleteRowButton resource="members" id={row.id} label={row.name} />
      </span>
    ),
  },
];

export const MemberList = () => {
  const navigate = useNavigate();
  // 기본 정렬: 최신 가입순
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Member>({
      resource: "members",
      sorters: { initial: [{ field: "createdAt", order: "desc" }] },
    });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">가입자</h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        sorters={sorters}
        setSorters={setSorters}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }])}
        searchPlaceholder="이름·이메일 검색"
        onRowClick={(row) => navigate(`/members/${row.id}`)}
      />
    </section>
  );
};
