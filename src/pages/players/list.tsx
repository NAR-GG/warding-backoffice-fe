import { useState } from "react";
import { useTable } from "@refinedev/core";
import { Lock } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { LeagueSelect } from "@/components/league-select";
import { DeleteRowButton } from "@/components/delete-row-button";
import {
  PlayerEditDialog,
  displayRiotIds,
  resolveImageUrl,
} from "./edit-dialogs";

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

  // 수정 버튼은 모든 리그에 노출한다 — 솔랭 계정 부착은 LCK 이력이 없어도 가능하기 때문
  // (LCK CL·해외 선수 추가 요청이 이 경로로 들어온다). 팀 이동·잠금 해제는 여전히 LCK 한정이고
  // 서버가 재검증하므로, 다이얼로그가 변경 내용에 따라 호출 경로를 고른다.
  const columns: Column<Player>[] = [
    { key: "id", title: "ID", sortable: true },
    {
      key: "imageUrl",
      title: "이미지",
      render: (row) => (
        <span className="flex items-center gap-1">
          {row.imageUrl ? (
            <img
              src={resolveImageUrl(row.imageUrl) ?? undefined}
              alt={row.name}
              className="size-8 rounded-full object-cover"
            />
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
        // 계정이 많으면 행이 지저분해져서 주계정(KR 우선) 1개 + 개수만 표시. 전체는 수정 다이얼로그에서.
        const ids = displayRiotIds(row.gameAccounts);
        return (
          <span className="flex items-center gap-1 text-sm whitespace-nowrap">
            {ids.length ? ids[0] : "-"}
            {ids.length > 1 && (
              <span className="text-muted-foreground">외 {ids.length - 1}</span>
            )}
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
          <PlayerEditDialog player={row} />
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
