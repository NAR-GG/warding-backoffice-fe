import { useState } from "react";
import { useList } from "@refinedev/core";
import { DataTable, type Column } from "@/components/data-table";

// cron 작업은 페이징 없는 고정 목록. 백엔드: GET /api/admin/cron-jobs → [{ name, type, schedule, expression, description }]
type CronJob = {
  name: string;
  type: string;
  schedule: string;
  expression: string;
  description: string;
};

const columns: Column<CronJob>[] = [
  { key: "name", title: "작업" },
  {
    key: "type",
    title: "유형",
    render: (row) => (
      <span
        className={
          row.type === "INTERVAL"
            ? "rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            : "rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300"
        }
      >
        {row.type === "INTERVAL" ? "간격" : "시각"}
      </span>
    ),
  },
  { key: "schedule", title: "주기" },
  {
    key: "expression",
    title: "원본",
    render: (row) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.expression}</code>
    ),
  },
  { key: "description", title: "설명" },
];

export const CronJobList = () => {
  const { result, query } = useList<CronJob>({
    resource: "cron-jobs",
    pagination: { mode: "off" },
  });

  // 고정 카탈로그(전체 로드)라 검색은 클라이언트 필터. 작업명·설명 부분일치.
  const [q, setQ] = useState("");
  const rows = [...(result?.data ?? [])]
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.description.toLowerCase().includes(q.toLowerCase())
    )
    // ponytail: 인터랙티브 정렬 대신 유형→작업명 기본 정렬. 정렬 UI 필요해지면 그때 추가.
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Cron 작업</h1>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey="name"
        isLoading={query.isLoading}
        onSearch={setQ}
        searchPlaceholder="작업명·설명 검색"
      />
    </section>
  );
};
