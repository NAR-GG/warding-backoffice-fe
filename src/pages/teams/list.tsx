import { useTable } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";
import { LeagueSelect } from "@/components/league-select";

type Team = {
  id: number;
  name: string;
  code: string;
};

const columns: Column<Team>[] = [
  { key: "id", title: "ID", sortable: true },
  { key: "name", title: "팀명", sortable: true },
  { key: "code", title: "코드", sortable: true },
];

export const TeamList = () => {
  // 기본 정렬: 팀명순
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Team>({
      resource: "teams",
      sorters: { initial: [{ field: "name", order: "asc" }] },
    });

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
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }])}
        searchPlaceholder="팀명·코드 검색"
        filterSlot={
          <LeagueSelect
            onChange={(league) =>
              setFilters([{ field: "league", operator: "eq", value: league }])
            }
          />
        }
      />
    </section>
  );
};
