import { useState } from "react";
import { useTable } from "@refinedev/core";
import { useNavigate } from "react-router";
import { DataTable, type Column } from "@/components/data-table";
import { EntityAvatar } from "@/components/entity-avatar";
import { CheerHeader } from "./header";

type CheerPlayer = {
  playerId: number;
  playerName: string;
  imageUrl: string | null;
  teamName: string | null;
  totalCount: number;
  memberCount: number;
  gameCount: number;
  lastCheeredAt: string;
};

const fmtDateTime = (iso: string) => iso.replace("T", " ").slice(0, 16);
const num = (n: number) => <span className="tabular-nums">{n.toLocaleString("ko-KR")}</span>;

const columns: Column<CheerPlayer>[] = [
  {
    key: "imageUrl",
    title: "이미지",
    render: (row) => <EntityAvatar src={row.imageUrl} name={row.playerName} />,
  },
  { key: "playerName", title: "선수" },
  { key: "teamName", title: "소속팀", render: (row) => row.teamName ?? "—" },
  {
    key: "totalCount",
    title: "받은 응원",
    sortable: true,
    render: (row) => <span className="font-medium">{num(row.totalCount)}</span>,
  },
  { key: "memberCount", title: "응원한 회원", sortable: true, render: (row) => num(row.memberCount) },
  { key: "gameCount", title: "판 수", sortable: true, render: (row) => num(row.gameCount) },
  {
    key: "lastCheeredAt",
    title: "마지막 응원",
    sortable: true,
    render: (row) => <span className="whitespace-nowrap">{fmtDateTime(row.lastCheeredAt)}</span>,
  },
];

// 응원받은 선수 랭킹. 행 클릭 → 그 선수를 응원한 회원 목록.
export const CheerPlayerList = () => {
  const navigate = useNavigate();
  const [days, setDays] = useState("");
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<CheerPlayer>({
      resource: "cheers/players",
      sorters: { initial: [{ field: "totalCount", order: "desc" }] },
      pagination: { pageSize: 20 },
    });

  return (
    <section className="space-y-4">
      <CheerHeader
        days={days}
        onDaysChange={(next) => {
          setDays(next);
          setFilters([{ field: "days", operator: "eq", value: next }], "merge");
        }}
      />
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="playerId"
        isLoading={tableQuery.isLoading}
        sorters={sorters}
        setSorters={setSorters}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onRowClick={(row) =>
          navigate(`/cheers/players/${row.playerId}?name=${encodeURIComponent(row.playerName)}`)
        }
      />
    </section>
  );
};
