import { useState } from "react";
import { useTable } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";
import { DeleteRowButton } from "@/components/delete-row-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 회원이 모바일에서 작성한 선수 리뷰(별점 1~5 + 한줄평 150자).
export type Rating = {
  id: number;
  matchId: string;
  leagueName: string | null;
  matchTitle: string | null;
  blueTeamCode: string | null;
  redTeamCode: string | null;
  matchDate: string | null;
  playerName: string;
  championName: string | null;
  role: string | null;
  memberNickname: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

const RATINGS = ["1", "2", "3", "4", "5"];
const ALL = "all";

// "2026-07-26T10:25:00" → "2026-07-26 10:25"
const formatDateTime = (value: string | null) =>
  value ? value.replace("T", " ").slice(0, 16) : "—";

const columns: Column<Rating>[] = [
  {
    key: "createdAt",
    title: "작성일",
    sortable: true,
    render: (row) => (
      <span className="whitespace-nowrap">{formatDateTime(row.createdAt)}</span>
    ),
  },
  { key: "memberNickname", title: "작성자" },
  {
    key: "leagueName",
    title: "리그",
    render: (row) => row.leagueName ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: "match",
    title: "경기",
    tooltip: "팀 대결과 매치 ID. 매치 정보 동기화 전이면 ID만 표시된다",
    render: (row) => (
      <span className="whitespace-nowrap">
        {row.blueTeamCode && row.redTeamCode ? (
          <>
            {row.blueTeamCode} <span className="text-muted-foreground">vs</span> {row.redTeamCode}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        <span className="block text-xs text-muted-foreground">{row.matchId}</span>
      </span>
    ),
  },
  {
    key: "matchDate",
    title: "경기일",
    render: (row) => (
      <span className="whitespace-nowrap">{formatDateTime(row.matchDate)}</span>
    ),
  },
  {
    key: "playerName",
    title: "선수",
    render: (row) => (
      <span className="whitespace-nowrap">
        {row.playerName}
        {row.championName && (
          <span className="text-muted-foreground"> · {row.championName}</span>
        )}
      </span>
    ),
  },
  {
    key: "rating",
    title: "별점",
    sortable: true,
    render: (row) => <span className="whitespace-nowrap">{"★".repeat(row.rating)}</span>,
  },
  {
    key: "comment",
    title: "한줄평",
    render: (row) =>
      row.comment ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: "actions",
    title: "관리",
    render: (row) => (
      <DeleteRowButton
        resource="ratings"
        id={row.id}
        label={`${row.playerName} 리뷰(${row.memberNickname})`}
      />
    ),
  },
];

export const RatingList = () => {
  const [rating, setRating] = useState(ALL);
  // 기본 정렬: 최신 작성순
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Rating>({
      resource: "ratings",
      sorters: { initial: [{ field: "createdAt", order: "desc" }] },
    });

  const changeRating = (next: string) => {
    setRating(next);
    // 빈 값이면 dataProvider 가 파라미터를 빼므로 "전체"는 빈 문자열로 보낸다
    setFilters([{ field: "rating", operator: "eq", value: next === ALL ? "" : next }], "merge");
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">리뷰</h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        sorters={sorters}
        setSorters={setSorters}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }], "merge")}
        searchPlaceholder="선수·작성자·한줄평 검색"
        filterSlot={
          <Select value={rating} onValueChange={changeRating}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>별점 전체</SelectItem>
              {RATINGS.map((r) => (
                <SelectItem key={r} value={r}>
                  {"★".repeat(Number(r))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </section>
  );
};
