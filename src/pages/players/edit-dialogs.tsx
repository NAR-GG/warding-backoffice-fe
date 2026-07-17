import { useState } from "react";
import { useList, useUpdate } from "@refinedev/core";
import { Pencil, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Player } from "./list";

// PUT /api/admin/players/{id} body: { imageUrl?, unlockImage?, currentTeamId? }
// 서버가 LCK 출전 이력을 재검증하므로 UI 는 편의 필터일 뿐이다.

const usePlayerUpdate = () => {
  const { mutate, mutation } = useUpdate();
  const save = (id: number, values: Record<string, unknown>, onDone: () => void) =>
    mutate(
      {
        resource: "players",
        id,
        values,
        successNotification: () => ({ message: "저장 완료", type: "success" }),
        errorNotification: (error) => ({
          message: "저장 실패",
          description: error?.message ?? "잠시 후 다시 시도해 주세요",
          type: "error",
        }),
      },
      { onSuccess: onDone }
    );
  return { save, isPending: mutation.isPending };
};

export function TeamChangeDialog({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<string>(player.currentTeamId ? String(player.currentTeamId) : "");
  const { save, isPending } = usePlayerUpdate();
  // 이동 대상은 LCK 팀만. size=50: LCK 팀 10±개라 1페이지로 충분.
  const { result } = useList<{ id: number; name: string }>({
    resource: "teams",
    filters: [{ field: "league", operator: "eq", value: "LCK" }],
    pagination: { currentPage: 1, pageSize: 50 },
    queryOptions: { enabled: open },
  });

  // 다이얼로그는 행에 상주(마운트 유지)라, 열 때마다 최신 행 값으로 리셋
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setTeamId(player.currentTeamId ? String(player.currentTeamId) : "");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="팀 변경">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{player.name} — 소속팀 변경</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>이동할 팀</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="팀 선택" />
            </SelectTrigger>
            <SelectContent>
              {(result?.data ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            과거 경기 기록·통계에는 영향이 없습니다. 자동 동기화도 이 값을 덮어쓰지 않습니다.
          </p>
        </div>
        <DialogFooter>
          <Button
            disabled={!teamId || isPending}
            onClick={() => save(player.id, { currentTeamId: Number(teamId) }, () => setOpen(false))}
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImageEditDialog({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(player.imageUrl ?? "");
  const [unlock, setUnlock] = useState(false);
  const { save, isPending } = usePlayerUpdate();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setUrl(player.imageUrl ?? "");
      setUnlock(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="이미지 수정">
          <ImageIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{player.name} — 이미지 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-center">
            {url ? (
              <img src={url} alt={player.name} className="size-24 rounded-full object-cover border" />
            ) : (
              <div className="size-24 rounded-full border bg-muted" />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="player-image-url">이미지 URL</Label>
            <Input
              id="player-image-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            저장하면 이미지가 잠겨 자동 동기화(매일 새벽 등)가 덮어쓰지 않습니다.
          </p>
          {player.imageLocked && (
            <div className="flex items-center gap-2">
              <Checkbox id="unlock" checked={unlock} onCheckedChange={(v) => setUnlock(v === true)} />
              <Label htmlFor="unlock" className="text-sm font-normal">
                잠금 해제 (자동 동기화가 다시 관리)
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || (!unlock && !url.trim())}
            onClick={() =>
              save(
                player.id,
                unlock ? { unlockImage: true } : { imageUrl: url.trim() },
                () => setOpen(false)
              )
            }
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
