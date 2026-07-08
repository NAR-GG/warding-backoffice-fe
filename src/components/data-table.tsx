import type { ReactNode } from "react";
import type { CrudSort } from "@refinedev/core";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Column<T> = {
  key: string;
  title: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: keyof T;
  isLoading?: boolean;
  sorters?: CrudSort[];
  setSorters?: (sorters: CrudSort[]) => void;
  pagination?: {
    currentPage: number;
    pageCount: number;
    setCurrentPage: (page: number) => void;
  };
};

// 서버 정렬(Refine core useTable) + shadcn Table. antd <Table> 대체.
// 정렬 클릭 시 해당 컬럼만 asc↔desc 토글(단일 정렬).
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  isLoading,
  sorters,
  setSorters,
  pagination,
}: Props<T>) {
  const orderOf = (key: string) => sorters?.find((s) => s.field === key)?.order;

  const toggleSort = (key: string) => {
    if (!setSorters) return;
    const next = orderOf(key) === "asc" ? "desc" : "asc";
    setSorters([{ field: key, order: next }]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>
                  {col.sortable && setSorters ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.title}
                      {orderOf(col.key) === "asc" ? (
                        <ArrowUp className="ml-1 size-3.5" />
                      ) : orderOf(col.key) === "desc" ? (
                        <ArrowDown className="ml-1 size-3.5" />
                      ) : (
                        <ChevronsUpDown className="ml-1 size-3.5 opacity-50" />
                      )}
                    </Button>
                  ) : (
                    col.title
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  불러오는 중…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  데이터가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={String(row[rowKey])}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.render ? col.render(row) : String(row[col.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            {pagination.currentPage} / {pagination.pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.currentPage <= 1}
            onClick={() => pagination.setCurrentPage(pagination.currentPage - 1)}
          >
            이전
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.currentPage >= pagination.pageCount}
            onClick={() => pagination.setCurrentPage(pagination.currentPage + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
