import { useRef, useState } from "react";
import { useCreate, useInvalidate, useOne, useUpdate } from "@refinedev/core";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { API_URL } from "@/providers/constants";
import { getValidToken } from "@/providers/auth";
import { PLACEMENT_LABEL, type Ad } from "./list";

// 이미지는 공지 이미지 업로드 API 를 그대로 쓴다 → { url }
async function uploadImage(file: File): Promise<string> {
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

export const AdCreate = () => <AdForm ad={null} />;

export const AdEdit = () => {
  const { id } = useParams();
  const { result, query } = useOne<Ad>({ resource: "ads", id: Number(id) });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  if (!result) return <p className="text-sm text-destructive">광고를 찾을 수 없습니다.</p>;
  return <AdForm ad={result} />;
};

function AdForm({ ad }: { ad: Ad | null }) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(ad?.title ?? "");
  const [placement, setPlacement] = useState<Ad["placement"]>(ad?.placement ?? "home");
  const [imageUrl, setImageUrl] = useState(ad?.imageUrl ?? "");
  const [linkUrl, setLinkUrl] = useState(ad?.linkUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(ad?.sortOrder ?? 0));
  const [active, setActive] = useState(ad?.active ?? true);
  const [startAt, setStartAt] = useState(ad?.startAt?.slice(0, 16) ?? "");
  const [endAt, setEndAt] = useState(ad?.endAt?.slice(0, 16) ?? "");
  const [uploading, setUploading] = useState(false);

  const invalidate = useInvalidate();
  const { mutate: create, mutation: creating } = useCreate();
  const { mutate: update, mutation: updating } = useUpdate();
  const busy = creating.isPending || updating.isPending || uploading;
  const valid = title.trim() !== "" && imageUrl !== "";

  const pick = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      setImageUrl(await uploadImage(file));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const values = {
      title: title.trim(),
      placement,
      imageUrl,
      linkUrl: linkUrl.trim() || null,
      sortOrder: Number(sortOrder) || 0,
      active,
      startAt: startAt ? `${startAt}:00` : null,
      endAt: endAt ? `${endAt}:00` : null,
    };
    const done = {
      onSuccess: () => {
        invalidate({ resource: "ads", invalidates: ["list", "detail"] });
        navigate("/ads");
      },
    };
    if (ad) update({ resource: "ads", id: ad.id, values }, done);
    else create({ resource: "ads", values }, done);
  };

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="목록으로" onClick={() => navigate("/ads")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{ad ? "광고 수정" : "새 광고"}</h1>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ad-title">이름 (관리용)</Label>
        <Input id="ad-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 도란 생일 서포트" />
      </div>

      <div className="space-y-2">
        <Label>배너 이미지</Label>
        {imageUrl && <img src={imageUrl} alt="미리보기" className="w-full max-w-md rounded-lg border" />}
        <div>
          <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "올리는 중…" : imageUrl ? "이미지 바꾸기" : "이미지 올리기"}
          </Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
            onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        <p className="text-xs text-muted-foreground">
          가로:세로 = 3.2:1 권장 (예: 1280×400). 5MB 이하 png/jpg/webp/gif.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ad-link">이동 주소 (선택)</Label>
        <Input id="ad-link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
        <p className="text-xs text-muted-foreground">https:// 로 시작. 비우면 눌러도 이동하지 않습니다. 외부 브라우저로 열립니다.</p>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="space-y-1">
          <Label htmlFor="ad-placement" className="text-xs">위치</Label>
          <select id="ad-placement" value={placement} onChange={(e) => setPlacement(e.target.value as Ad["placement"])}
            className="h-9 rounded-md border bg-background px-2 text-sm">
            {Object.entries(PLACEMENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ad-order" className="text-xs">순서 (작을수록 먼저)</Label>
          <Input id="ad-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-28" />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <Switch checked={active} onCheckedChange={setActive} /> 노출
        </label>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="space-y-1">
          <Label htmlFor="ad-start" className="text-xs">시작 (비우면 즉시)</Label>
          <Input id="ad-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-52" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ad-end" className="text-xs">종료 (비우면 무기한)</Label>
          <Input id="ad-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-52" />
        </div>
      </div>

      <div className="flex justify-end border-t pt-4">
        <Button disabled={busy || !valid} onClick={save}>저장</Button>
      </div>
    </section>
  );
}
