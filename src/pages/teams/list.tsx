import { useState } from "react";
import { useTable } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";
import { LeagueSelect } from "@/components/league-select";
import { DeleteRowButton } from "@/components/delete-row-button";

type Team = {
  id: number;
  name: string;
  code: string;
};

const columns: Column<Team>[] = [
  { key: "id", title: "ID", sortable: true },
  { key: "name", title: "팀명", sortable: true },
  { key: "code", title: "코드", sortable: true },
  {
    key: "actions",
    title: "관리",
    render: (row) => <DeleteRowButton resource="teams" id={row.id} label={row.name} />,
  },
];

export const TeamList = () => {
  const [league, setLeague] = useState("LCK"); // 기본 LCK — 리그가 많아 초기 화면을 좁힌다
  // 기본 정렬: 팀명순
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Team>({
      resource: "teams",
      sorters: { initial: [{ field: "name", order: "asc" }] },
      filters: { initial: [{ field: "league", operator: "eq", value: "LCK" }] },
    });

  const changeLeague = (next: string) => {
    setLeague(next);
    // "merge" 모드: 리그 필터만 교체하고 q(검색) 필터는 유지
    setFilters([{ field: "league", operator: "eq", value: next }], "merge");
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">팀</h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        sorters={sorters}
        setSorters={setSorters}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }], "merge")}
        searchPlaceholder="팀명·코드 검색"
        filterSlot={<LeagueSelect value={league} onChange={changeLeague} />}
      />
    </section>
  );
};
