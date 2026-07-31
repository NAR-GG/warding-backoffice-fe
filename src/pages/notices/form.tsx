import { useState } from "react";
import { useCreate, useInvalidate, useOne, useUpdate } from "@refinedev/core";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NoticeEditor } from "@/components/notice-editor";
import { API_URL } from "@/providers/constants";
import { getToken } from "@/providers/auth";
import { USE_NOTICE_MOCK } from "@/providers/data";
import type { Notice } from "./list";

// 이미지 업로드: 에디터에 파일을 붙여넣기/드롭하면 호출.
// 백엔드: POST /api/admin/notices/images (multipart "file") → { url }
// mock 모드에서는 dataURL 로 대체해 로컬에서 미리보기까지 확인한다.
async function uploadImage(file: File): Promise<string> {
  if (USE_NOTICE_MOCK) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
  const body = new FormData();
  body.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/notices/images`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });
  if (!res.ok) throw new Error(`이미지 업로드 실패 (${res.status})`);
  return (await res.json()).url as string;
}

export const NoticeCreate = () => <NoticeForm notice={null} />;

export const NoticeEdit = () => {
  const { id } = useParams();
  const { result, query } = useOne<Notice>({ resource: "notices", id: Number(id) });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  if (!result) return <p className="text-sm text-destructive">공지를 찾을 수 없습니다.</p>;
  return <NoticeForm notice={result} />;
};

function NoticeForm({ notice }: { notice: Notice | null }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [pinned, setPinned] = useState(notice?.pinned ?? false);
  const [banner, setBanner] = useState(!!notice?.promoteUntil);
  const [promoteUntil, setPromoteUntil] = useState(notice?.promoteUntil?.slice(0, 10) ?? "");

  const invalidate = useInvalidate();
  const { mutate: create, mutation: creating } = useCreate();
  const { mutate: update, mutation: updating } = useUpdate();
  const busy = creating.isPending || updating.isPending;
  const valid = title.trim() !== "" && content.trim() !== "" && (!banner || promoteUntil !== "");

  const save = (published: boolean) => {
    const values = {
      title: title.trim(),
      content: content.trim(),
      pinned,
      promoteUntil: banner && promoteUntil ? promoteUntil : null,
      published,
    };
    const done = {
      onSuccess: () => {
        invalidate({ resource: "notices", invalidates: ["list"] });
        navigate("/notices");
      },
    };
    if (notice) update({ resource: "notices", id: notice.id, values }, done);
    else create({ resource: "notices", values }, done);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="목록으로" onClick={() => navigate("/notices")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{notice ? "공지 수정" : "새 공지 작성"}</h1>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notice-title">제목</Label>
        <Input
          id="notice-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
        />
        <p className="text-xs text-muted-foreground">
          구분이 필요하면 말머리를 제목에 직접: [업데이트] [반영완료] [점검] [이벤트]
        </p>
      </div>

      <div className="space-y-2">
        <Label>본문</Label>
        <NoticeEditor value={content} onChange={setContent} uploadImage={uploadImage} />
        <p className="text-xs text-muted-foreground">
          이미지는 붙여넣기(⌘V)·드래그·툴바 버튼으로 삽입됩니다.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={pinned} onCheckedChange={setPinned} /> 상단 고정
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={banner} onCheckedChange={setBanner} /> 앱 캘린더 띠배너 노출
        </label>
        {banner && (
          <div className="space-y-1">
            <Label htmlFor="notice-promote-until" className="text-xs">
              배너 종료일
            </Label>
            <Input
              id="notice-promote-until"
              type="date"
              value={promoteUntil}
              onChange={(e) => setPromoteUntil(e.target.value)}
              className="w-40"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" disabled={busy || !valid} onClick={() => save(false)}>
          임시저장
        </Button>
        <Button disabled={busy || !valid} onClick={() => save(true)}>
          발행
        </Button>
      </div>
    </section>
  );
}
