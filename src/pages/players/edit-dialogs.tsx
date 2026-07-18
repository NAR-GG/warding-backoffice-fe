import { useState } from "react";
import { useList, useUpdate } from "@refinedev/core";
import { Pencil, Trash2 } from "lucide-react";
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
import { API_URL } from "@/providers/constants";
import type { Player } from "./list";

export type GameAccount = { region: string; riotId: string; tier: string | null };

// players.game_accounts raw JSON 파싱. 형식이 깨져 있으면 빈 배열(수정 시 새로 작성).
export function parseGameAccounts(raw: string | null): GameAccount[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.map((a) => ({ region: a.region ?? "", riotId: a.riotId ?? "", tier: a.tier ?? null }))
      : [];
  } catch {
    return [];
  }
}

// (표시 전용 헬퍼들 — 편집은 원본 값 그대로)
// 표시용 정리: 크롤러가 riotId에 붙여둔 잔여 텍스트("... Unranked", "Show Inactive (3)")를
// 태그 뒤 첫 공백 기준으로 잘라낸다.
export function formatRiotId(riotId: string): string {
  const m = riotId.match(/^(.*#\S+)/);
  return m ? m[1] : riotId;
}

// 목록 컬럼 표시용: KR 계정(추적 주계정) 우선 + 표시용 정리.
export function displayRiotIds(raw: string | null): string[] {
  const accounts = parseGameAccounts(raw);
  const sorted = [
    ...accounts.filter((a) => a.region === "KR"),
    ...accounts.filter((a) => a.region !== "KR"),
  ];
  return sorted.map((a) => formatRiotId(a.riotId)).filter(Boolean);
}

// DB의 선수 이미지는 상대경로(/images/players/…) — 백엔드가 서빙하므로 API 호스트를 붙인다.
export function resolveImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

// 선수 통합 수정 다이얼로그: 소속팀·이미지·솔랭 계정을 한 모달에서 수정.
// PUT /api/admin/players/{id} — 바뀐 필드만 골라 한 번에 전송. 서버가 필드별로 독립 처리하고
// LCK 출전 이력을 재검증한다. 잠금 해제 체크 시 해당 필드의 새 값 입력은 무시(서버 else-if와 동일).
export function PlayerEditDialog({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [url, setUrl] = useState("");
  const [unlockImage, setUnlockImage] = useState(false);
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [unlockAccounts, setUnlockAccounts] = useState(false);

  const { mutate, mutation } = useUpdate();
  // 이동 대상은 LCK 팀만. size=50: LCK 팀 10±개라 1페이지로 충분.
  const { result: teams } = useList<{ id: number; name: string }>({
    resource: "teams",
    filters: [{ field: "league", operator: "eq", value: "LCK" }],
    pagination: { currentPage: 1, pageSize: 50 },
    queryOptions: { enabled: open },
  });

  // 다이얼로그는 행에 상주(마운트 유지)라, 열 때마다 최신 행 값으로 리셋
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setTeamId(player.currentTeamId ? String(player.currentTeamId) : "");
      setUrl(player.imageUrl ?? "");
      setUnlockImage(false);
      setAccounts(parseGameAccounts(player.gameAccounts));
      setUnlockAccounts(false);
    }
  };

  const setAccountField = (i: number, field: "region" | "riotId", value: string) =>
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));

  // 변경분만 모아 payload 구성 — 아무것도 안 바꿨으면 저장 비활성.
  const initialAccounts = JSON.stringify(parseGameAccounts(player.gameAccounts));
  const accountsChanged = JSON.stringify(accounts) !== initialAccounts;
  const accountsValid = accounts.every((a) => a.region.trim() && /^.+#.+$/.test(a.riotId.trim()));
  const teamChanged = teamId !== (player.currentTeamId ? String(player.currentTeamId) : "");
  const imageChanged = url.trim() !== (player.imageUrl ?? "");

  const payload: Record<string, unknown> = {};
  if (teamChanged && teamId) payload.currentTeamId = Number(teamId);
  if (unlockImage) payload.unlockImage = true;
  else if (imageChanged && url.trim()) payload.imageUrl = url.trim();
  if (unlockAccounts) payload.unlockGameAccounts = true;
  else if (accountsChanged && accountsValid)
    payload.gameAccounts = accounts.map((a) => ({
      region: a.region.trim(),
      riotId: a.riotId.trim(),
      tier: a.tier,
    }));

  const invalidAccounts = accountsChanged && !unlockAccounts && !accountsValid;
  const canSave = Object.keys(payload).length > 0 && !invalidAccounts && !mutation.isPending;

  const save = () =>
    mutate(
      {
        resource: "players",
        id: player.id,
        values: payload,
        successNotification: () => ({ message: "저장 완료", type: "success" }),
        errorNotification: (error) => ({
          message: "저장 실패",
          description: error?.message ?? "잠시 후 다시 시도해 주세요",
          type: "error",
        }),
      },
      { onSuccess: () => setOpen(false) }
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="선수 수정">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>선수 정보 수정</DialogTitle>
        </DialogHeader>

        {/* 소속팀 */}
        <div className="space-y-2">
          <Label>소속팀</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="팀 선택" />
            </SelectTrigger>
            <SelectContent>
              {(teams?.data ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            과거 경기 기록·통계에는 영향 없음. 자동 동기화가 덮어쓰지 않음.
          </p>
        </div>

        {/* 이미지 */}
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor={`image-url-${player.id}`}>이미지 URL</Label>
          <div className="flex items-center gap-3">
            {url.trim() ? (
              <img
                src={resolveImageUrl(url.trim()) ?? undefined}
                alt={player.name}
                className="size-14 rounded-full object-cover border shrink-0"
              />
            ) : (
              <div className="size-14 rounded-full border bg-muted shrink-0" />
            )}
            <Input
              id={`image-url-${player.id}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… 또는 /images/players/…"
            />
          </div>
          {player.imageLocked ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`unlock-image-${player.id}`}
                checked={unlockImage}
                onCheckedChange={(v) => setUnlockImage(v === true)}
              />
              <Label htmlFor={`unlock-image-${player.id}`} className="text-sm font-normal">
                이미지 잠금 해제 (자동 동기화가 다시 관리)
              </Label>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">저장하면 잠겨서 자동 동기화가 덮어쓰지 않음.</p>
          )}
        </div>

        {/* 솔랭 계정 */}
        <div className="space-y-2 border-t pt-4">
          <Label>솔랭 계정</Label>
          {accounts.map((acc, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="w-16"
                value={acc.region}
                onChange={(e) => setAccountField(i, "region", e.target.value)}
                placeholder="KR"
              />
              <Input
                value={acc.riotId}
                onChange={(e) => setAccountField(i, "riotId", e.target.value)}
                placeholder="이름#태그"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="계정 삭제"
                onClick={() => setAccounts((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAccounts((prev) => [...prev, { region: "KR", riotId: "", tier: null }])}
          >
            계정 추가
          </Button>
          {invalidAccounts && (
            <p className="text-xs text-destructive">모든 계정은 지역과 “이름#태그” 형식이 필요합니다.</p>
          )}
          <p className="text-xs text-muted-foreground">
            저장 시 Riot 계정 실존 확인(없는 아이디 거부) 후 랭크 추적에 즉시 반영. 저장 후엔 잠겨서
            크롤러가 되돌리지 않음.
          </p>
          {player.gameAccountsLocked && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`unlock-accounts-${player.id}`}
                checked={unlockAccounts}
                onCheckedChange={(v) => setUnlockAccounts(v === true)}
              />
              <Label htmlFor={`unlock-accounts-${player.id}`} className="text-sm font-normal">
                계정 잠금 해제 (크롤러가 다시 관리)
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button disabled={!canSave} onClick={save}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
