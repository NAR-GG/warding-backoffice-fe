import { useOne } from "@refinedev/core";
import { useNavigate, useParams } from "react-router";
import { EditorContent, useEditor } from "@tiptap/react";
import { ArrowLeft, Pencil, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { noticeExtensions } from "@/components/notice-editor";
import type { Notice } from "./list";

const fmtDateTime = (iso: string | null) =>
  iso ? `${iso.slice(0, 10).replaceAll("-", ".")} ${iso.slice(11, 16)}` : "";

/** 공지 읽기 전용 조회. 목록 행 클릭으로 진입한다. */
export const NoticeView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { result, query } = useOne<Notice>({ resource: "notices", id: Number(id) });

  if (query.isLoading) return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  if (!result) return <p className="text-sm text-destructive">공지를 찾을 수 없습니다.</p>;

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="목록으로" onClick={() => navigate("/notices")}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-2xl font-semibold">공지 조회</h1>
        </div>
        <Button variant="outline" onClick={() => navigate(`/notices/${result.id}/edit`)}>
          <Pencil className="size-4" /> 수정
        </Button>
      </div>

      <div className="space-y-3 border-b pb-5">
        <div className="flex items-center gap-2 text-xl font-semibold">
          {result.pinned && <Pin className="size-4 text-muted-foreground" />}
          {result.title}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground tabular-nums">
          <span>id {result.id}</span>
          {result.publishedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium text-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              발행 {fmtDateTime(result.publishedAt)}
            </span>
          ) : (
            <span className="rounded-md border border-dashed px-2 py-0.5 text-xs font-medium">
              임시저장
            </span>
          )}
          {result.promoteUntil && (
            <span className="rounded-md border px-2 py-0.5 text-xs font-medium">
              배너 ~{fmtDateTime(result.promoteUntil).slice(0, 10)}
            </span>
          )}
          <span>등록 {fmtDateTime(result.createdAt)}</span>
        </div>
      </div>

      <NoticeContentView markdown={result.content} />
    </section>
  );
};

/** 에디터와 같은 확장 세트로 마크다운을 읽기 전용 렌더링. */
function NoticeContentView({ markdown }: { markdown: string }) {
  const editor = useEditor({
    extensions: noticeExtensions(),
    content: markdown,
    editable: false,
  });
  if (!editor) return null;
  return <EditorContent editor={editor} className="notice-editor notice-view" />;
}
