import { useEffect, useState, type ReactNode } from "react";
import type { CrudSort } from "@refinedev/core";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  // 검색: onSearch 주면 표 위에 디바운스(300ms) 입력창 렌더.
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  // 검색창 옆 추가 필터(예: 리그 드롭다운).
  filterSlot?: ReactNode;
};

function SearchInput({
  onSearch,
  placeholder,
}: {
  onSearch: (value: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    const t = setTimeout(() => onSearch(value.trim()), 300);
    return () => clearTimeout(t);
    // onSearch 는 useTable setFilters 래퍼로 안정적. value 변화에만 반응.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative max-w-xs">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-8"
        placeholder={placeholder ?? "검색"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}

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
  onSearch,
  searchPlaceholder,
  filterSlot,
}: Props<T>) {
  const orderOf = (key: string) => sorters?.find((s) => s.field === key)?.order;

  const toggleSort = (key: string) => {
    if (!setSorters) return;
    const next = orderOf(key) === "asc" ? "desc" : "asc";
    setSorters([{ field: key, order: next }]);
  };

  return (
    <div className="space-y-4">
      {(onSearch || filterSlot) && (
        <div className="flex flex-wrap items-center gap-2">
          {onSearch && (
            <SearchInput onSearch={onSearch} placeholder={searchPlaceholder} />
          )}
          {filterSlot}
        </div>
      )}
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
