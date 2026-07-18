# 선수 솔랭 계정(game_accounts) 어드민 수정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 닉변 시 어드민이 선수의 솔랭 계정(Riot ID)을 즉시 수정하고, 크롤러(매일 05:30)가 되돌리지 못하게 잠근다.

**Architecture:** 기존 LCK 선수 수정 PUT을 확장. `players.game_accounts`(JSON: `[{region, riotId, tier}]`)에 이미지와 동일한 잠금 패턴(`game_accounts_locked`) 적용 — 엔티티 `updateProfile`이 잠금 시 gameAccounts 필드만 보존. puuid 재해석은 기존 06:00 크론(`syncPrimaryRiotAccounts`)이 자동 수행하므로 추가 작업 없음.

**Tech Stack:** 기존과 동일. 브랜치도 동일(feat/backoffice-write, feat/lck-admin-write — 열린 PR에 커밋 추가).

## Global Constraints

- 주석/커밋 한국어, Conventional Commits + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- LCK 서버 검증은 기존 `PlayerAdminService.update()` 경로 재사용(추가 검증 코드 금지).
- `game_accounts` JSON 스키마 유지: `[{"region":"KR","riotId":"Name#Tag","tier":"..."}]` — 크론 파서(RiotIdParser/extractPrimaryKrAccount)가 이 형식을 읽는다.
- FE: kebab-case, 인라인 style 금지, ui/ 수동 수정 금지.

---

## Task 1: 백엔드 — V55 + 엔티티 잠금 + PUT 확장

**Files:**
- Create: `/Users/changha/dev/nar/src/main/resources/db/migration/V55__Add_player_game_accounts_lock.sql`
- Modify: `/Users/changha/dev/nar/src/main/java/com/toy/nar/domain/participant/entity/Player.java`
- Modify: `/Users/changha/dev/nar/src/main/java/com/toy/nar/app/participant/service/PlayerAdminService.java`
- Modify: `/Users/changha/dev/nar/src/main/java/com/toy/nar/api/admin/BackofficeController.java`
- Test: `/Users/changha/dev/nar/src/test/java/com/toy/nar/domain/participant/entity/PlayerImageLockTest.java` (테스트 추가)
- Test: `/Users/changha/dev/nar/src/test/java/com/toy/nar/app/participant/service/PlayerAdminServiceTest.java` (테스트 추가)

**Interfaces:**
- Produces (API 계약):
  - PlayerRow에 `gameAccounts: String`(raw JSON, null 가능), `gameAccountsLocked: boolean` 추가.
  - PUT body에 `gameAccounts?: List<GameAccountEntry>`(record: region, riotId, tier — tier null 허용), `unlockGameAccounts?: Boolean` 추가.
  - 검증 실패(빈 region, riotId에 `#` 없음) → `IllegalArgumentException` → **400** `{message}` (신규 핸들러 — 기존 league-configs의 IllegalArgumentException 500도 함께 개선됨).

- [ ] **Step 1: 실패하는 테스트 추가**

`PlayerImageLockTest.java`에 추가:
```java
	@Test
	@DisplayName("overrideGameAccounts는 계정을 바꾸고 잠근다; 이후 updateProfile(크롤러)은 gameAccounts만 보존한다")
	void overrideGameAccounts_locksAgainstCrawler() {
		Player player = Player.builder().name("Faker").build();

		player.overrideGameAccounts("[{\"region\":\"KR\",\"riotId\":\"Hide on bush#KR1\",\"tier\":null}]");
		assertThat(player.isGameAccountsLocked()).isTrue();

		player.updateProfile("이상혁", "1996-05-07", 30, "MID", "[{\"riotId\":\"stale#OLD\"}]");
		assertThat(player.getGameAccounts()).contains("Hide on bush#KR1"); // 계정은 보존
		assertThat(player.getRealName()).isEqualTo("이상혁"); // 나머지 프로필은 갱신

		player.unlockGameAccounts();
		player.updateProfile("이상혁", "1996-05-07", 30, "MID", "[{\"riotId\":\"new#SYNC\"}]");
		assertThat(player.getGameAccounts()).contains("new#SYNC");
	}
```

`PlayerAdminServiceTest.java`에 추가 (기존 스타일/mock 패턴 재사용):
```java
	@Test
	@DisplayName("gameAccounts 수정 시 JSON 직렬화·잠금, riotId 형식(#) 검증")
	void updatesGameAccounts() {
		Player player = Player.builder().name("Faker").build();
		when(playerRepository.findWithCurrentTeamById(1L)).thenReturn(Optional.of(player));
		when(playerRepository.hasLeagueParticipation(1L, "LCK")).thenReturn(true);

		Player updated = playerAdminService.update(1L, null, null, null, null,
				List.of(new BackofficeController.GameAccountEntry("KR", "Hide on bush#KR1", null)));

		assertThat(updated.getGameAccounts()).contains("Hide on bush#KR1");
		assertThat(updated.isGameAccountsLocked()).isTrue();
	}

	@Test
	@DisplayName("riotId에 #이 없으면 IllegalArgumentException")
	void rejectsInvalidRiotId() {
		Player player = Player.builder().name("Faker").build();
		when(playerRepository.findWithCurrentTeamById(1L)).thenReturn(Optional.of(player));
		when(playerRepository.hasLeagueParticipation(1L, "LCK")).thenReturn(true);

		assertThatThrownBy(() -> playerAdminService.update(1L, null, null, null, null,
				List.of(new BackofficeController.GameAccountEntry("KR", "NoTagLine", null))))
				.isInstanceOf(IllegalArgumentException.class);
	}
```
(시그니처 확장 형태는 Step 3 참조 — update(id, imageUrl, unlockImage, currentTeamId, unlockGameAccounts, gameAccounts). 구현 시 파라미터가 5개를 넘으니 record `PlayerAdminUpdate`로 묶어도 좋다 — 묶으면 테스트도 그에 맞춘다. 어느 쪽이든 테스트와 구현이 일치하면 됨.)

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.domain.participant.entity.PlayerImageLockTest" --tests "com.toy.nar.app.participant.service.PlayerAdminServiceTest"`
Expected: 컴파일 에러 — FAIL.

- [ ] **Step 3: 구현**

V55 마이그레이션:
```sql
-- 솔랭 계정(game_accounts) 수동 잠금. true면 프로필 크롤러(매일 05:30)가 game_accounts를 덮어쓰지 못한다.
ALTER TABLE players
    ADD COLUMN game_accounts_locked BOOLEAN NOT NULL DEFAULT FALSE;
```

Player.java — 필드 + 메서드 (image_locked 패턴과 대칭, columnDefinition 포함):
```java
	// true면 프로필 크롤러가 game_accounts를 덮어쓰지 못한다(updateProfile에서 보존).
	@Column(name = "game_accounts_locked", nullable = false, columnDefinition = "BOOLEAN NOT NULL DEFAULT FALSE")
	private boolean gameAccountsLocked;
```
```java
	public void updateProfile(String realName, String birthDate, Integer age,
			String role, String gameAccounts) {
		this.realName = realName;
		this.birthDate = birthDate;
		this.age = age;
		this.role = role;
		if (!gameAccountsLocked) {
			this.gameAccounts = gameAccounts;
		}
	}

	// 백오피스 수동 수정: 계정 교체 + 크롤러 잠금.
	public void overrideGameAccounts(String gameAccountsJson) {
		this.gameAccounts = gameAccountsJson;
		this.gameAccountsLocked = true;
	}

	public void unlockGameAccounts() {
		this.gameAccountsLocked = false;
	}
```

BackofficeController.java:
```java
    public record GameAccountEntry(String region, String riotId, String tier) {}

    public record PlayerUpdateRequest(String imageUrl, Boolean unlockImage, Long currentTeamId,
                                      Boolean unlockGameAccounts, List<GameAccountEntry> gameAccounts) {}
```
- PlayerRow에 `gameAccounts`(String), `gameAccountsLocked`(boolean) 필드 추가 + `from()` 갱신.
- `updatePlayer`가 확장된 요청을 서비스로 전달.
- 핸들러 추가:
```java
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> onInvalidArgument(IllegalArgumentException e) {
        return Map.of("message", e.getMessage());
    }
```

PlayerAdminService.java — 파라미터 확장 + 검증/직렬화 (ObjectMapper 주입):
```java
		if (Boolean.TRUE.equals(unlockGameAccounts)) {
			player.unlockGameAccounts();
		} else if (gameAccounts != null) {
			player.overrideGameAccounts(serializeGameAccounts(gameAccounts));
		}
```
```java
	// 크론 파서(RiotIdParser)가 읽는 형식 유지: [{"region","riotId","tier"}], riotId는 반드시 gameName#tagLine.
	private String serializeGameAccounts(List<BackofficeController.GameAccountEntry> accounts) {
		for (var acc : accounts) {
			if (acc.region() == null || acc.region().isBlank()) {
				throw new IllegalArgumentException("region은 비울 수 없습니다");
			}
			if (acc.riotId() == null || !acc.riotId().matches("^.+#.+$")) {
				throw new IllegalArgumentException("riotId는 '이름#태그' 형식이어야 합니다: " + acc.riotId());
			}
		}
		try {
			return objectMapper.writeValueAsString(accounts);
		} catch (com.fasterxml.jackson.core.JsonProcessingException e) {
			throw new IllegalArgumentException("계정 정보 직렬화 실패", e);
		}
	}
```
(컨트롤러 record 의존이 역방향이라 싫으면 GameAccountEntry를 서비스 쪽으로 옮기고 컨트롤러가 참조 — 구현자가 판단, 순환만 없으면 됨.)

- [ ] **Step 4: 통과 확인 + 회귀**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.domain.participant.*" --tests "com.toy.nar.app.participant.*" --tests "com.toy.nar.app.riot.*"`
Expected: 전부 PASS (riot 크론 파서 회귀 포함).

- [ ] **Step 5: 커밋**

```bash
cd /Users/changha/dev/nar && git add -A src/main/java src/main/resources/db/migration src/test && git commit -m "feat: 백오피스에서 선수 솔랭 계정(game_accounts) 수정·크롤러 잠금

닉변 시 어드민이 즉시 수정할 수 있게 PUT /players/{id}에 gameAccounts 추가.
수동 수정 시 game_accounts_locked로 잠가 매일 05:30 프로필 크롤러가 되돌리지 못한다.
puuid 재해석은 기존 06:00 syncPrimaryRiotAccounts 크론이 자동 수행.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: 프론트 — 계정 컬럼 + 수정 다이얼로그

**Files:**
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/pages/players/list.tsx`
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/pages/players/edit-dialogs.tsx`
- Modify: `/Users/changha/dev/warding-backoffice-fe/CLAUDE.md` (함정/구조 한 줄 갱신)

**Interfaces:**
- Consumes: Task 1 API 계약 — PlayerRow의 `gameAccounts`(raw JSON string|null), `gameAccountsLocked`; PUT body `{ gameAccounts: [{region, riotId, tier}] }` 또는 `{ unlockGameAccounts: true }`.

- [ ] **Step 1: Player 타입/컬럼**

`list.tsx` Player 타입에 `gameAccounts: string | null; gameAccountsLocked: boolean;` 추가.
컬럼 추가(소속팀 다음):
```tsx
    {
      key: "gameAccounts",
      title: "솔랭 계정",
      render: (row) => {
        const ids = parseRiotIds(row.gameAccounts);
        return (
          <span className="flex items-center gap-1 text-sm">
            {ids.length ? ids.join(", ") : "-"}
            {row.gameAccountsLocked && (
              <Lock className="size-3 text-muted-foreground" aria-label="수동 고정" />
            )}
          </span>
        );
      },
    },
```
`parseRiotIds`는 edit-dialogs.tsx에서 export (아래 Step 2) — JSON.parse 실패 시 빈 배열.

관리 컬럼에 `{editable && <AccountsEditDialog player={row} />}` 추가 (팀변경/이미지 다음).

- [ ] **Step 2: AccountsEditDialog**

`edit-dialogs.tsx`에 추가. 기존 두 다이얼로그 패턴(usePlayerUpdate, handleOpenChange 리셋) 그대로 따른다:

```tsx
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

export function parseRiotIds(raw: string | null): string[] {
  return parseGameAccounts(raw).map((a) => a.riotId).filter(Boolean);
}

export function AccountsEditDialog({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<GameAccount[]>(() => parseGameAccounts(player.gameAccounts));
  const [unlock, setUnlock] = useState(false);
  const { save, isPending } = usePlayerUpdate();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setAccounts(parseGameAccounts(player.gameAccounts));
      setUnlock(false);
    }
  };

  const setField = (i: number, field: "region" | "riotId", value: string) =>
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));

  const valid = accounts.every((a) => a.region.trim() && /^.+#.+$/.test(a.riotId.trim()));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="솔랭 계정 수정">
          <Gamepad2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{player.name} — 솔랭 계정 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {accounts.map((acc, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="w-16"
                value={acc.region}
                onChange={(e) => setField(i, "region", e.target.value)}
                placeholder="KR"
              />
              <Input
                value={acc.riotId}
                onChange={(e) => setField(i, "riotId", e.target.value)}
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
          <p className="text-sm text-muted-foreground">
            저장하면 잠겨서 프로필 크롤러(매일 새벽)가 되돌리지 않습니다. puuid·랭크 추적은 다음
            동기화(매일 06:00)에 자동 반영됩니다.
          </p>
          {player.gameAccountsLocked && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`unlock-accounts-${player.id}`}
                checked={unlock}
                onCheckedChange={(v) => setUnlock(v === true)}
              />
              <Label htmlFor={`unlock-accounts-${player.id}`} className="text-sm font-normal">
                잠금 해제 (크롤러가 다시 관리)
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || (!unlock && !valid)}
            onClick={() =>
              save(
                player.id,
                unlock
                  ? { unlockGameAccounts: true }
                  : {
                      gameAccounts: accounts.map((a) => ({
                        region: a.region.trim(),
                        riotId: a.riotId.trim(),
                        tier: a.tier,
                      })),
                    },
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
```
아이콘 import: `Gamepad2`, `Trash2` (lucide-react). `Player` 타입 import는 기존 유지.
주의: 기존 ImageEditDialog의 unlock 체크박스 `id="unlock"`이 행마다 중복(같은 DOM id) — 이 다이얼로그처럼 `player.id` 포함 id를 쓰면서, 겸사겸사 ImageEditDialog의 id도 `unlock-image-${player.id}`로 고친다(접근성 버그 수정).

- [ ] **Step 3: CLAUDE.md 갱신**

- 구조 표 `edit-dialogs.tsx` 행: "팀 이동/이미지 URL/솔랭 계정 수정"으로.
- 함정 6번에 한 줄 추가: "선수 솔랭 계정도 `game_accounts_locked`로 동일 보호(크롤러 05:30이 못 덮음). puuid 반영은 06:00 크론 자동."

- [ ] **Step 4: 빌드 + 커밋**

Run: `npm run build` → 성공.
```bash
git add src/pages/players CLAUDE.md && git commit -m "feat: 선수 솔랭 계정(Riot ID) 표시·수정 다이얼로그

닉변 시 어드민이 즉시 수정. 저장 시 잠금으로 크롤러 되돌림 방지, 해제 체크박스 제공.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: PR 본문 갱신**

두 PR(nar#268, warding-backoffice-fe#4)에 `gh pr edit --body` 또는 코멘트로 솔랭 계정 수정 기능 추가 사실 반영 (컨트롤러가 수행).
