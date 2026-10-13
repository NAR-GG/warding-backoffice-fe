import { useList } from "@refinedev/core";
import { useNavigate } from "react-router";
import { Pencil, Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { DeleteRowButton } from "@/components/delete-row-button";
import { Button } from "@/components/ui/button";

// 광고 배너 관리. 백엔드: /api/admin/ads (배열 응답) GET·POST·PUT·DELETE.
// 이미지는 POST /api/admin/notices/images 로 올린 URL. 앱은 GET /api/ads 로 노출 중인 것만 받는다.
export type Ad = {
  id: number;
  title: string;
  placement: "home" | "match_list" | "match_detail" | "splash" | "popup";
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
};

export const PLACEMENT_LABEL: Record<Ad["placement"], string> = {
  home: "홈",
  match_list: "경기 리스트",
  match_detail: "경기 상세",
  splash: "스플래시",
  popup: "팝업",
};

// 위치별 이미지 규격(앱 광고 안내와 같다). 등록 폼 안내에 쓴다.
export const PLACEMENT_SIZE: Record<Ad["placement"], string> = {
  home: "가로 3.2:1 (960×300)",
  match_list: "가로 3.2:1 (960×300)",
  match_detail: "가로 3.2:1 (960×300)",
  splash: "가로 3:2 (1080×720)",
  popup: "세로 3:4 (1080×1440)",
};

const fmt = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : "");

// 지금 앱에 나가는지(서버 판정과 같은 규칙). 시각은 서버 로컬 = 입력한 그대로 비교한다.
function status(a: Ad): string {
  if (!a.active) return "꺼짐";
  const now = new Date().toISOString().slice(0, 16);
  if (a.startAt && a.startAt.slice(0, 16) > now) return "대기";
  if (a.endAt && a.endAt.slice(0, 16) <= now) return "종료";
  return "노출 중";
}

export const AdList = () => {
  const navigate = useNavigate();
  const { result, query } = useList<Ad>({ resource: "ads", pagination: { mode: "off" } });

  const columns: Column<Ad>[] = [
    {
      key: "imageUrl",
      title: "이미지",
      render: (row) => <img src={row.imageUrl} alt={row.title} className="h-10 w-32 rounded object-cover" />,
    },
    { key: "title", title: "이름", render: (row) => <span className="font-medium">{row.title}</span> },
    { key: "placement", title: "위치", render: (row) => PLACEMENT_LABEL[row.placement] },
    { key: "status", title: "상태", render: (row) => status(row) },
    {
      key: "period",
      title: "기간",
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {row.startAt || row.endAt ? `${fmt(row.startAt) || "…"} ~ ${fmt(row.endAt) || "…"}` : "상시"}
        </span>
      ),
    },
    { key: "sortOrder", title: "순서", render: (row) => <span className="tabular-nums">{row.sortOrder}</span> },
    {
      key: "actions",
      title: "",
      render: (row) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon-sm" aria-label="수정" onClick={() => navigate(`/ads/${row.id}/edit`)}>
            <Pencil className="size-4" />
          </Button>
          <DeleteRowButton resource="ads" id={row.id} label={row.title} />
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">광고</h1>
        <Button onClick={() => navigate("/ads/new")}>
          <Plus className="size-4" /> 새 광고
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        같은 위치에 여러 개면 순서가 작은 광고 1개가 나갑니다. 노출 중인 광고가 없는 위치는 광고주 모집 배너가 나갑니다.
      </p>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={query.isLoading}
        onRowClick={(row) => navigate(`/ads/${row.id}/edit`)}
      />
    </section>
  );
};
