import { useTable } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";

type Member = {
  id: number;
  name: string;
  email: string;
  favoriteLeagueName: string;
  createdAt: string;
};

const columns: Column<Member>[] = [
  { key: "id", title: "ID", sortable: true },
  { key: "name", title: "이름" },
  { key: "email", title: "이메일" },
  { key: "favoriteLeagueName", title: "관심 리그" },
  { key: "createdAt", title: "가입일", sortable: true },
];

export const MemberList = () => {
  // 기본 정렬: 최신 가입순
  const { result, tableQuery, sorters, setSorters, currentPage, setCurrentPage, pageCount } =
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
      />
    </section>
  );
};
