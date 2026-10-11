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
import { getValidToken } from "@/providers/auth";
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
  const token = await getValidToken();
  const res = await fetch(`${API_URL}/api/admin/notices/images`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });
  if (!res.ok) throw new Error(`이미지 업로드 실패 (${res.status})`);
  return (await res.json()).url as string;
}

// 서버(NoticeService)와 같은 규칙: 영문 소문자·숫자·하이픈 40자 이내.
const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

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
  const [slug, setSlug] = useState(notice?.slug ?? "");
  const [actionUrl, setActionUrl] = useState(notice?.actionUrl ?? "");

  const invalidate = useInvalidate();
  const { mutate: create, mutation: creating } = useCreate();
  const { mutate: update, mutation: updating } = useUpdate();
  const busy = creating.isPending || updating.isPending;
  // 전용 페이지(slug 있음)는 앱 공지 목록·띠배너에 나가지 않아 고정·배너 옵션이 의미가 없다.
  const isPage = slug.trim() !== "";
  const slugValid = slug.trim() === "" || SLUG_PATTERN.test(slug.trim());
  const urlValid = actionUrl.trim() === "" || actionUrl.trim().startsWith("https://");
  const valid =
    title.trim() !== "" &&
    content.trim() !== "" &&
    (isPage || !banner || promoteUntil !== "") &&
    slugValid &&
    urlValid;

  const save = (published: boolean) => {
    const values = {
      title: title.trim(),
      // 에디터(tiptap-markdown)는 줄바꿈을 `\`+개행으로 직렬화하는데 앱 렌더러는 그
      // `\` 를 본문 글자로 그린다 → 저장 직전에 순수 개행으로. 옛 공지도 재저장하면 정리됨.
      content: content.trim().replace(/\\\n/g, "\n"),
      pinned: isPage ? false : pinned,
      promoteUntil: !isPage && banner && promoteUntil ? promoteUntil : null,
      published,
      // 빈 문자열은 서버가 "버튼 없음"으로 읽는다(수정 때는 기존 버튼 제거).
      actionUrl: actionUrl.trim(),
      // slug 는 생성 때만 서버가 반영한다(수정 요청의 slug 는 무시).
      slug: notice ? undefined : slug.trim() || null,
    };
    const done = {
      onSuccess: () => {
        // detail 도 비워야 조회 페이지가 수정 전 캐시를 보여주지 않는다.
        invalidate({ resource: "notices", invalidates: ["list", "detail"] });
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

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">앱 전용 페이지 (선택)</p>
          <p className="text-xs text-muted-foreground">
            앱이 공지 목록이 아니라 전용 화면으로 여는 고정 페이지입니다. 광고 안내는 식별자{" "}
            <code>ad-guide</code> (앱 마이페이지 › 고객 지원 › 광고 안내).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="notice-slug">식별자</Label>
            {notice ? (
              <p className="flex h-9 items-center text-sm">
                {notice.slug ? <code>{notice.slug}</code> : <span className="text-muted-foreground">없음 (일반 공지)</span>}
              </p>
            ) : (
              <Input
                id="notice-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ad-guide"
                aria-invalid={!slugValid}
              />
            )}
            {!slugValid && (
              <p className="text-xs text-destructive">영문 소문자·숫자·하이픈 40자 이내로 입력하세요.</p>
            )}
            {notice?.slug && (
              <p className="text-xs text-muted-foreground">
                식별자는 바꿀 수 없고 삭제도 할 수 없습니다. 앱에서 내리려면 임시저장으로 저장하세요.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="notice-action-url">하단 고정 버튼 주소</Label>
            <Input
              id="notice-action-url"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="https://forms.gle/..."
              aria-invalid={!urlValid}
            />
            {!urlValid ? (
              <p className="text-xs text-destructive">https:// 로 시작하는 주소만 쓸 수 있습니다.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                비우면 버튼이 나오지 않습니다. 앱에서 외부 브라우저로 열립니다.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        {!isPage && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={pinned} onCheckedChange={setPinned} /> 상단 고정
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={banner} onCheckedChange={setBanner} /> 앱 캘린더 띠배너 노출
            </label>
          </>
        )}
        {!isPage && banner && (
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
