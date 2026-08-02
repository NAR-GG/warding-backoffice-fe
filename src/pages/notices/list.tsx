import { useTable } from "@refinedev/core";
import { useNavigate } from "react-router";
import { Pencil, Pin, Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { DeleteRowButton } from "@/components/delete-row-button";
import { Button } from "@/components/ui/button";

// 공지사항 관리. 백엔드:
//   GET    /api/admin/notices?page&size  → Spring Page (임시저장 포함, 최신순)
//   POST   /api/admin/notices            body { title, content, pinned, promoteUntil, published }
//   PUT    /api/admin/notices/{id}       body 동일
//   DELETE /api/admin/notices/{id}
//   POST   /api/admin/notices/images     multipart "file" → { url } (본문 이미지)
// 작성자 입력 없음 — 앱에는 항상 "관리자"로 노출. 카테고리 없음 — 말머리를 제목에 직접([업데이트] 등).
export type Notice = {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  // 앱 캘린더 상단 띠배너 노출 종료일(ISO). null 이면 배너 미노출.
  promoteUntil: string | null;
  // null 이면 임시저장(앱 미노출).
  publishedAt: string | null;
  createdAt: string;
  // 앱이 공지를 열 때 POST /api/notices/{id}/view 로 +1. 중복 제거 없는 총 열람 수.
  viewCount: number;
};

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10).replaceAll("-", ".") : "");
const fmtDateTime = (iso: string | null) =>
  iso ? `${fmtDate(iso)} ${iso.slice(11, 16)}` : "";

export const NoticeList = () => {
  const navigate = useNavigate();
  const { result, tableQuery, currentPage, setCurrentPage, pageCount } = useTable<Notice>({
    resource: "notices",
    pagination: { pageSize: 20 },
  });

  const columns: Column<Notice>[] = [
    { key: "id", title: "번호", render: (row) => <span className="text-muted-foreground">{row.id}</span> },
    {
      key: "pinned",
      title: "고정",
      render: (row) =>
        row.pinned ? <Pin className="size-4 text-muted-foreground" /> : null,
    },
    {
      key: "title",
      title: "제목",
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "promoteUntil",
      title: "배너",
      tooltip: "앱 캘린더 상단 띠배너 노출 종료일. 비어 있으면 배너로 나가지 않습니다.",
      render: (row) =>
        row.promoteUntil ? (
          <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            ~{fmtDate(row.promoteUntil)}
          </span>
        ) : null,
    },
    {
      key: "publishedAt",
      title: "상태",
      render: (row) =>
        row.publishedAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            발행
          </span>
        ) : (
          <span className="rounded-md border border-dashed px-2 py-0.5 text-xs font-medium text-muted-foreground">
            임시저장
          </span>
        ),
    },
    {
      key: "viewCount",
      title: "조회수",
      tooltip: "앱에서 공지를 연 총 횟수(중복 제거 없음). 임시저장 공지는 앱에 안 나가므로 0입니다.",
      render: (row) => (
        <span className="tabular-nums">{row.viewCount?.toLocaleString() ?? "-"}</span>
      ),
    },
    {
      key: "createdAt",
      title: "등록일",
      render: (row) => <span className="tabular-nums">{fmtDateTime(row.createdAt)}</span>,
    },
    {
      key: "actions",
      title: "",
      // 행 클릭(조회 이동)과 겹치지 않게 버튼 영역 클릭은 전파를 막는다.
      render: (row) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="수정"
            onClick={() => navigate(`/notices/${row.id}/edit`)}
          >
            <Pencil className="size-4" />
          </Button>
          <DeleteRowButton resource="notices" id={row.id} label={row.title} />
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">공지사항</h1>
        <Button onClick={() => navigate("/notices/new")}>
          <Plus className="size-4" /> 새 공지 작성
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onRowClick={(row) => navigate(`/notices/${row.id}`)}
      />
    </section>
  );
};
