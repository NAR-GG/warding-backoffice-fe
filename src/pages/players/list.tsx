import { useTable } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";

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
  // 기본 정렬: 선수명 가나다/알파벳순
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Player>({
      resource: "players",
      sorters: { initial: [{ field: "name", order: "asc" }] },
    });

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
        onSearch={(q) =>
          setFilters(q ? [{ field: "q", operator: "contains", value: q }] : [])
        }
        searchPlaceholder="선수명·실명 검색"
      />
    </section>
  );
};
