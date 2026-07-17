import { useState } from "react";
import { useTable } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";
import { LeagueSelect } from "@/components/league-select";

type Player = {
  id: number;
  name: string;
  realName: string;
  role: string;
  age: number;
};

const columns: Column<Player>[] = [
  { key: "id", title: "ID", sortable: true },
  { key: "name", title: "선수명", sortable: true },
  { key: "realName", title: "실명" },
  { key: "role", title: "포지션" },
  { key: "age", title: "나이", sortable: true },
];

export const PlayerList = () => {
  const [league, setLeague] = useState("LCK"); // 기본 LCK — 리그가 많아 초기 화면을 좁힌다
  // 기본 정렬: 선수명 가나다/알파벳순
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Player>({
      resource: "players",
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
      <h1 className="text-2xl font-semibold">선수</h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        sorters={sorters}
        setSorters={setSorters}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }], "merge")}
        searchPlaceholder="선수명·실명 검색"
        filterSlot={<LeagueSelect value={league} onChange={changeLeague} />}
      />
    </section>
  );
};
