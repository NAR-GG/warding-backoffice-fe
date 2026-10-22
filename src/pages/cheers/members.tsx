import { useState } from "react";
import { useTable } from "@refinedev/core";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { CheerHeader } from "./header";

// 응원한 회원 한 줄. 횟수·판 수는 기간/선수 필터가 걸린 범위 안에서 센다.
type CheerMember = {
  memberId: number;
  nickname: string;
  email: string | null;
  totalCount: number;
  gameCount: number;
  playerCount: number;
  topPlayerName: string | null;
  firstCheeredAt: string;
  lastCheeredAt: string;
};

const fmtDateTime = (iso: string) => iso.replace("T", " ").slice(0, 16);
const num = (n: number) => <span className="tabular-nums">{n.toLocaleString("ko-KR")}</span>;

const columns: Column<CheerMember>[] = [
  { key: "memberId", title: "회원 ID" },
  { key: "nickname", title: "닉네임" },
  { key: "email", title: "이메일", render: (row) => row.email ?? "—" },
  {
    key: "totalCount",
    title: "누른 횟수",
    sortable: true,
    render: (row) => <span className="font-medium">{num(row.totalCount)}</span>,
  },
  { key: "gameCount", title: "판 수", sortable: true, tooltip: "응원한 솔랭 판 수", render: (row) => num(row.gameCount) },
  { key: "playerCount", title: "선수 수", sortable: true, render: (row) => num(row.playerCount) },
  { key: "topPlayerName", title: "최다 응원 선수", render: (row) => row.topPlayerName ?? "—" },
  {
    key: "firstCheeredAt",
    title: "첫 응원",
    sortable: true,
    render: (row) => <span className="whitespace-nowrap">{fmtDateTime(row.firstCheeredAt)}</span>,
  },
  {
    key: "lastCheeredAt",
    title: "마지막 응원",
    sortable: true,
    render: (row) => <span className="whitespace-nowrap">{fmtDateTime(row.lastCheeredAt)}</span>,
  },
];

/**
 * 응원한 회원 랭킹. 기본은 누른 횟수 많은 순 — "마지막 응원" 헤더를 누르면 최근 누른 순.
 * /cheers/players/:playerId 로 들어오면 그 선수를 응원한 회원만 본다(선수 랭킹 행 클릭).
 * 행 클릭 → 가입자 상세.
 */
export const CheerMemberList = () => {
  const { playerId } = useParams();
  const [searchParams] = useSearchParams();
  const playerName = searchParams.get("name");
  const navigate = useNavigate();
  const [days, setDays] = useState("");

  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<CheerMember>({
      resource: "cheers/members",
      sorters: { initial: [{ field: "totalCount", order: "desc" }] },
      filters: { permanent: playerId ? [{ field: "playerId", operator: "eq", value: playerId }] : [] },
      pagination: { pageSize: 20 },
    });

  const changeDays = (next: string) => {
    setDays(next);
    setFilters([{ field: "days", operator: "eq", value: next }], "merge");
  };

  return (
    <section className="space-y-4">
      {playerId ? (
        <>
          <Link
            to="/cheers/players"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            선수 랭킹으로
          </Link>
          <h1 className="text-2xl font-semibold">
            {playerName ?? `선수 #${playerId}`} 응원한 회원
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {result?.total ?? 0}명
            </span>
          </h1>
        </>
      ) : (
        <CheerHeader days={days} onDaysChange={changeDays} />
      )}
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="memberId"
        isLoading={tableQuery.isLoading}
        sorters={sorters}
        setSorters={setSorters}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }], "merge")}
        searchPlaceholder="닉네임·이메일 검색"
        onRowClick={(row) => navigate(`/members/${row.memberId}`)}
      />
    </section>
  );
};
