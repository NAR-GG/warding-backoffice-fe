import { useState } from "react";
import { useTable } from "@refinedev/core";
import { Lock } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { LeagueSelect } from "@/components/league-select";
import { DeleteRowButton } from "@/components/delete-row-button";
import { TeamChangeDialog, ImageEditDialog, AccountsEditDialog, parseRiotIds } from "./edit-dialogs";

export type Player = {
  id: number;
  name: string;
  realName: string;
  role: string;
  age: number;
  imageUrl: string | null;
  currentTeamId: number | null;
  currentTeamName: string | null;
  imageLocked: boolean;
  gameAccounts: string | null;
  gameAccountsLocked: boolean;
};

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
    // "merge": 리그 필터만 교체하고 q(검색) 필터는 유지
    setFilters([{ field: "league", operator: "eq", value: next }], "merge");
  };

  // 수정(팀/이미지)은 LCK 선수 한정. UI 는 리그 필터가 LCK 일 때만 노출하고, 서버도 재검증한다.
  const editable = league === "LCK";

  const columns: Column<Player>[] = [
    { key: "id", title: "ID", sortable: true },
    {
      key: "imageUrl",
      title: "이미지",
      render: (row) => (
        <span className="flex items-center gap-1">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.name} className="size-8 rounded-full object-cover" />
          ) : (
            <span className="size-8 rounded-full bg-muted inline-block" />
          )}
          {row.imageLocked && <Lock className="size-3 text-muted-foreground" aria-label="수동 고정" />}
        </span>
      ),
    },
    { key: "name", title: "선수명", sortable: true },
    { key: "realName", title: "실명" },
    { key: "currentTeamName", title: "소속팀", render: (row) => row.currentTeamName ?? "-" },
    {
      key: "gameAccounts",
      title: "솔랭 계정",
      render: (row) => {
        const ids = parseRiotIds(row.gameAccounts);
        return (
          <span className="flex items-center gap-1 text-sm">
            {ids.length ? ids.join(", ") : "-"}
            {row.gameAccountsLocked && (
              <Lock className="size-3 text-muted-foreground" aria-label="수동 고정" />
            )}
          </span>
        );
      },
    },
    { key: "role", title: "포지션" },
    { key: "age", title: "나이", sortable: true },
    {
      key: "actions",
      title: "관리",
      render: (row) => (
        <span className="flex items-center">
          {editable && <TeamChangeDialog player={row} />}
          {editable && <ImageEditDialog player={row} />}
          {editable && <AccountsEditDialog player={row} />}
          <DeleteRowButton resource="players" id={row.id} label={row.name} />
        </span>
      ),
    },
  ];

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
