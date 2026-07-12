import { useState } from "react";
import { useList, useUpdate } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";
import { Switch } from "@/components/ui/switch";

// 리그별 수집/알림/동기화 토글. 백엔드: GET /api/admin/league-configs (배열, 페이징 없음),
// PUT /api/admin/league-configs/{leagueName} body { liveEnabled, notificationEnabled, syncEnabled }
type LeagueConfig = {
  leagueName: string;
  liveEnabled: boolean;
  notificationEnabled: boolean;
  syncEnabled: boolean;
};

type ToggleKey = "liveEnabled" | "notificationEnabled" | "syncEnabled";

export const LeagueConfigList = () => {
  const { result, query } = useList<LeagueConfig>({
    resource: "league-configs",
    pagination: { mode: "off" },
  });
  const { mutate } = useUpdate<LeagueConfig>();
  // 뮤테이션 중인 행: 해당 행 토글만 잠금. 옵티미스틱 없음 — 성공 리페치가 화면 갱신.
  const [pending, setPending] = useState<string | null>(null);

  const toggle = (row: LeagueConfig, key: ToggleKey) => {
    setPending(row.leagueName);
    mutate(
      {
        resource: "league-configs",
        id: row.leagueName,
        values: {
          liveEnabled: row.liveEnabled,
          notificationEnabled: row.notificationEnabled,
          syncEnabled: row.syncEnabled,
          [key]: !row[key],
        },
        successNotification: false,
        errorNotification: () => ({
          message: "설정 변경 실패",
          description: "잠시 후 다시 시도해 주세요",
          type: "error",
        }),
      },
      { onSettled: () => setPending(null) }
    );
  };

  const toggleColumn = (key: ToggleKey, title: string): Column<LeagueConfig> => ({
    key,
    title,
    render: (row) => (
      <Switch
        checked={row[key]}
        disabled={pending === row.leagueName}
        onCheckedChange={() => toggle(row, key)}
      />
    ),
  });

  const columns: Column<LeagueConfig>[] = [
    { key: "leagueName", title: "리그" },
    toggleColumn("liveEnabled", "라이브 수집"),
    toggleColumn("notificationEnabled", "디스코드 알림"),
    toggleColumn("syncEnabled", "경기 동기화"),
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">리그 설정</h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="leagueName"
        isLoading={query.isLoading}
      />
    </section>
  );
};
