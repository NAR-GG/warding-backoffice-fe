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

  const toggleColumn = (key: ToggleKey, title: string, tooltip: string): Column<LeagueConfig> => ({
    key,
    title,
    tooltip,
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
    toggleColumn(
      "liveEnabled",
      "라이브 수집",
      "진행 중 경기를 5초 간격으로 폴링해 실시간 골드·킬·오브젝트·선수 평점을 수집합니다. 끄면 이 리그의 라이브 데이터가 쌓이지 않습니다."
    ),
    toggleColumn(
      "notificationEnabled",
      "디스코드 알림",
      "세트 시작·종료 시 디스코드 웹훅과 앱 푸시를 보냅니다. 수집과 별개로 알림만 제어합니다."
    ),
    toggleColumn(
      "syncEnabled",
      "경기 동기화",
      "6시간마다 경기 일정·결과·팀 정보를 가져와 저장합니다. 라이브 수집도 이 일정을 참조하므로 끄면 라이브 발견도 어려워집니다."
    ),
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
