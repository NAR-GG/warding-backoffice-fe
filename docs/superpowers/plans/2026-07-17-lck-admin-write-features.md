# LCK 어드민 쓰기 기능 구현 계획 (팀 이동·삭제·이미지 수정·sync 보호)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백오피스에서 LCK 선수 팀 이동/이미지 수정, 가입자·선수·팀 삭제를 가능하게 하고, 수동 수정한 선수 이미지가 자동 동기화에 덮어써지지 않게 보호한다.

**Architecture:** 백엔드(`/Users/changha/dev/nar`, Spring Boot)에 `players.current_team_id`(신규 소속팀 개념)와 `players.image_locked`(sync 보호 플래그) 컬럼을 추가하고 PUT/DELETE 엔드포인트를 연다. 프론트(`/Users/changha/dev/warding-backoffice-fe`, Refine v5 + shadcn)는 검색형 리그 콤보박스(기본 LCK), 행 단위 수정/삭제 UI를 붙인다. 과거 경기 기록(`game_participants`)은 절대 건드리지 않는다.

**Tech Stack:** Spring Boot 3 + JPA + Flyway + JUnit5(@DataJpaTest, H2) / React 19 + Refine v5 + shadcn/ui + Tailwind v4

## Global Constraints

- 서술형 산출물(주석/커밋/문서)은 **한국어**. 커밋은 Conventional Commits(`feat:`, `fix:` …).
- 백엔드 커밋 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 프론트: 파일명 kebab-case, 인라인 style 금지(Tailwind만), `src/components/ui/` 직접 수정 금지.
- 백엔드: `/api/admin/**`은 SecurityConfig가 ROLE_ADMIN으로 이미 보호 — 컨트롤러에 별도 인증 코드 금지.
- 선수 수정(팀/이미지)은 **서버에서 LCK 출전 이력 검증** 필수(UI만 믿지 않는다).
- 삭제 정책: 가입자 = 자식 테이블 정리 후 삭제. 선수/팀 = FK 걸리면 409 + 안내 메시지.
- `game_participants`(경기 기록)는 어떤 태스크에서도 수정/삭제하지 않는다.

---

## Part A — 백엔드 (`/Users/changha/dev/nar`)

### Task 1: Flyway 마이그레이션 — current_team_id / image_locked

**Files:**
- Create: `/Users/changha/dev/nar/src/main/resources/db/migration/V54__Add_player_current_team_and_image_lock.sql`

**Interfaces:**
- Produces: `players.current_team_id BIGINT NULL(FK→teams)`, `players.image_locked BOOLEAN NOT NULL DEFAULT FALSE`. 이후 태스크의 엔티티 매핑이 이 컬럼명을 사용.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 선수 "소속팀" 개념 신설 + 수동 이미지 잠금.
-- current_team_id: 백오피스에서 수동 관리하는 현재 소속팀. 경기 기록(game_participants)과 무관하며 sync가 건드리지 않는다.
-- image_locked: true면 자동 동기화(epromatch/디스크 마이그레이션 등)가 image_url을 덮어쓰지 못한다.
ALTER TABLE players
    ADD COLUMN current_team_id BIGINT NULL,
    ADD COLUMN image_locked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT fk_players_current_team FOREIGN KEY (current_team_id) REFERENCES teams (team_id);

-- 백필: 선수별 가장 최근 경기의 팀(전 리그). 경기 기록 없는 선수는 NULL 유지.
UPDATE players p
JOIN (
    SELECT playerId, teamId FROM (
        SELECT gp.player_id AS playerId,
               gp.team_id   AS teamId,
               ROW_NUMBER() OVER (
                   PARTITION BY gp.player_id
                   ORDER BY g.actual_game_start_time DESC, g.game_id DESC
               ) AS rn
        FROM game_participants gp
        JOIN games g ON gp.game_id = g.game_id
    ) ranked
    WHERE rn = 1
) latest ON latest.playerId = p.player_id
SET p.current_team_id = latest.teamId;
```

- [ ] **Step 2: 마이그레이션 파일명/버전 검증**

Run: `ls /Users/changha/dev/nar/src/main/resources/db/migration | sort -V | tail -3`
Expected: `V52…`, `V53…`, `V54__Add_player_current_team_and_image_lock.sql` 순으로 V54가 마지막.

- [ ] **Step 3: 커밋**

```bash
cd /Users/changha/dev/nar
git add src/main/resources/db/migration/V54__Add_player_current_team_and_image_lock.sql
git commit -m "feat: players에 current_team_id·image_locked 컬럼 추가 및 최근 경기 팀 백필

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Player 엔티티 — 소속팀·이미지 잠금 (sync 가드는 엔티티에서 강제)

**Files:**
- Modify: `/Users/changha/dev/nar/src/main/java/com/toy/nar/domain/participant/entity/Player.java`
- Test: `/Users/changha/dev/nar/src/test/java/com/toy/nar/domain/participant/entity/PlayerImageLockTest.java` (신규)

**Interfaces:**
- Produces: `player.getCurrentTeam(): Team`, `player.isImageLocked(): boolean`, `player.overrideImage(String)`, `player.unlockImage()`, `player.changeCurrentTeam(Team)`. 기존 `setImageUrl(String)`은 잠금 시 무시(no-op)로 동작 변경 — **이 한 곳으로 PlayerService(3곳)·PlayerImageMigrationService(1곳)의 자동 덮어쓰기가 전부 차단됨**.

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.toy.nar.domain.participant.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

// 이미지 잠금 규칙: 수동 수정(overrideImage)하면 잠기고, 잠긴 뒤에는 sync 경로(setImageUrl)가 못 덮는다.
class PlayerImageLockTest {

	@Test
	@DisplayName("overrideImage는 이미지를 바꾸고 잠근다; 이후 setImageUrl(sync)은 무시된다")
	void overrideImage_locksAgainstSync() {
		Player player = Player.builder().name("Faker").imageUrl("old.png").build();

		player.overrideImage("manual.png");
		assertThat(player.getImageUrl()).isEqualTo("manual.png");
		assertThat(player.isImageLocked()).isTrue();

		player.setImageUrl("sync.png"); // 자동 동기화 경로
		assertThat(player.getImageUrl()).isEqualTo("manual.png"); // 덮어쓰기 차단
	}

	@Test
	@DisplayName("unlockImage 후에는 sync가 다시 덮어쓸 수 있다")
	void unlockImage_allowsSyncAgain() {
		Player player = Player.builder().name("Faker").imageUrl("old.png").build();
		player.overrideImage("manual.png");

		player.unlockImage();
		player.setImageUrl("sync.png");

		assertThat(player.getImageUrl()).isEqualTo("sync.png");
		assertThat(player.isImageLocked()).isFalse();
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.domain.participant.entity.PlayerImageLockTest"`
Expected: 컴파일 에러(`overrideImage`, `isImageLocked` 미정의) — FAIL.

- [ ] **Step 3: 엔티티 구현**

`Player.java`의 `gameAccounts` 필드 선언 아래에 필드 추가, `setImageUrl` 수정, 메서드 3개 추가:

```java
	@Column(name = "game_accounts", columnDefinition = "JSON")
	private String gameAccounts;

	// 백오피스에서 수동 관리하는 현재 소속팀. 경기 기록(GameParticipant)과 무관 — sync가 건드리지 않는다.
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "current_team_id")
	private Team currentTeam;

	// true면 자동 동기화가 imageUrl을 덮어쓰지 못한다(setImageUrl no-op).
	@Column(name = "image_locked", nullable = false)
	private boolean imageLocked;
```

```java
	// 자동 동기화 경로. 수동 잠금 상태면 무시 — 모든 sync 호출부(PlayerService, PlayerImageMigrationService)가 이 한 곳으로 보호된다.
	public void setImageUrl(String imageUrl) {
		if (imageLocked) {
			return;
		}
		this.imageUrl = imageUrl;
	}

	// 백오피스 수동 수정: 이미지 교체 + sync 잠금.
	public void overrideImage(String imageUrl) {
		this.imageUrl = imageUrl;
		this.imageLocked = true;
	}

	public void unlockImage() {
		this.imageLocked = false;
	}

	public void changeCurrentTeam(Team team) {
		this.currentTeam = team;
	}
```

import 추가: `jakarta.persistence.FetchType`, `jakarta.persistence.JoinColumn`, `jakarta.persistence.ManyToOne`.
`@ToString` 이 클래스에 있으므로 LAZY 프록시 순환 방지를 위해 클래스의 `@ToString`을 `@ToString(exclude = "currentTeam")`으로 변경.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.domain.participant.entity.PlayerImageLockTest"`
Expected: PASS (2 tests).

- [ ] **Step 5: 기존 이미지 sync 테스트 회귀 확인**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.app.riot.*" --tests "com.toy.nar.domain.participant.*"`
Expected: 전부 PASS. (setImageUrl 의미 변경이 기존 테스트를 깨면, 해당 테스트가 잠금 없는 신규 Player를 쓰는지 확인 — 신규 Player는 imageLocked=false라 동작 동일해야 정상.)

- [ ] **Step 6: 커밋**

```bash
cd /Users/changha/dev/nar
git add src/main/java/com/toy/nar/domain/participant/entity/Player.java src/test/java/com/toy/nar/domain/participant/entity/PlayerImageLockTest.java
git commit -m "feat: Player 소속팀(currentTeam)·이미지 잠금(imageLocked) 도입

수동 수정(overrideImage) 시 잠금이 걸려 자동 동기화(setImageUrl)가 덮어쓰지 못한다.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: PlayerRepository — currentTeam 즉시 로딩 + LCK 출전 판정

**Files:**
- Modify: `/Users/changha/dev/nar/src/main/java/com/toy/nar/domain/participant/repository/PlayerRepository.java`
- Test: `/Users/changha/dev/nar/src/test/java/com/toy/nar/domain/participant/repository/PlayerRepositoryLckParticipationTest.java` (신규)

**Interfaces:**
- Consumes: Task 2의 `Player.currentTeam`.
- Produces: `searchForBackoffice`가 currentTeam을 fetch(컨트롤러에서 LazyInitialization 없이 팀명 접근 가능), `boolean hasLeagueParticipation(Long playerId, String leagueName)`.

- [ ] **Step 1: 실패하는 테스트 작성**

기존 `/Users/changha/dev/nar/src/test/java/com/toy/nar/domain/participant/repository/PlayerRepositoryLckPlayerOptionsTest.java`를 먼저 읽고, 그 파일의 **League/Game/Team/GameParticipant 픽스처 생성 헬퍼를 그대로 복사**해 사용한다(동일 `@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})` 구성). 테스트 본문:

```java
	@Test
	@DisplayName("LCK 경기 출전 기록이 있으면 true, 없으면 false")
	void hasLeagueParticipation() {
		// 픽스처 헬퍼로 LCK 리그 + 경기 + 참가(faker), LPL 리그 + 경기 + 참가(lplOnly) 구성
		// (기존 PlayerRepositoryLckPlayerOptionsTest의 생성 패턴을 그대로 따른다)

		assertThat(playerRepository.hasLeagueParticipation(faker.getId(), "LCK")).isTrue();
		assertThat(playerRepository.hasLeagueParticipation(lplOnly.getId(), "LCK")).isFalse();
	}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.domain.participant.repository.PlayerRepositoryLckParticipationTest"`
Expected: 컴파일 에러(`hasLeagueParticipation` 미정의) — FAIL.

- [ ] **Step 3: 리포지토리 구현**

`searchForBackoffice`에 `@EntityGraph` 추가(기존 `@Query` 유지):

```java
	// 백오피스 검색: 선수명·실명 부분일치 + 리그 필터. q/league 가 null 이면 각 조건 무시.
	// 리그는 출전 기록(GameParticipant→Game→League) 기준 EXISTS 로 판정(전 시즌 통합).
	// currentTeam은 목록 응답에 팀명을 실어야 해서 EntityGraph로 함께 로딩(N+1/LAZY 예외 방지).
	@EntityGraph(attributePaths = {"currentTeam"})
	@Query("""
			SELECT p FROM Player p
			WHERE (:q IS NULL
			       OR LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%'))
			       OR LOWER(p.realName) LIKE LOWER(CONCAT('%', :q, '%')))
			  AND (:league IS NULL
			       OR EXISTS (SELECT 1 FROM GameParticipant gp
			                  WHERE gp.player = p AND gp.game.league.leagueName = :league))
			""")
	Page<Player> searchForBackoffice(@Param("q") String q, @Param("league") String league, Pageable pageable);

	// 해당 리그 출전 이력 여부. 백오피스 선수 수정의 "LCK만 허용" 서버 검증에 사용.
	@Query("""
			SELECT COUNT(gp) > 0 FROM GameParticipant gp
			WHERE gp.player.id = :playerId AND gp.game.league.leagueName = :leagueName
			""")
	boolean hasLeagueParticipation(@Param("playerId") Long playerId, @Param("leagueName") String leagueName);
```

import 추가: `org.springframework.data.jpa.repository.EntityGraph`.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.domain.participant.repository.*"`
Expected: 신규 포함 전부 PASS (기존 searchForBackoffice 테스트로 @EntityGraph 회귀도 확인됨).

- [ ] **Step 5: 커밋**

```bash
cd /Users/changha/dev/nar
git add src/main/java/com/toy/nar/domain/participant/repository/PlayerRepository.java src/test/java/com/toy/nar/domain/participant/repository/PlayerRepositoryLckParticipationTest.java
git commit -m "feat: 백오피스용 currentTeam 로딩·리그 출전 판정 쿼리 추가

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: PlayerAdminService·MemberDeleteService

**Files:**
- Create: `/Users/changha/dev/nar/src/main/java/com/toy/nar/app/participant/service/PlayerAdminService.java`
- Create: `/Users/changha/dev/nar/src/main/java/com/toy/nar/app/member/service/MemberDeleteService.java` (`app/member/service` 폴더가 없으면 기존 member 관련 서비스 위치를 `grep -rl "class Member.*Service" src/main/java`로 찾아 그 패키지에 둔다)
- Test: `/Users/changha/dev/nar/src/test/java/com/toy/nar/app/participant/service/PlayerAdminServiceTest.java`

**Interfaces:**
- Consumes: Task 2 `overrideImage/unlockImage/changeCurrentTeam`, Task 3 `hasLeagueParticipation`.
- Produces:
  - `PlayerAdminService.update(Long playerId, String imageUrl, Boolean unlockImage, Long currentTeamId): Player` — LCK 검증 포함. 미존재 → `NoSuchElementException`, 비LCK → `IllegalStateException`.
  - `MemberDeleteService.delete(Long memberId): void` — 자식 테이블 정리 후 삭제. 미존재 → `NoSuchElementException`.

- [ ] **Step 1: 실패하는 테스트 작성 (PlayerAdminService, Mockito 단위)**

```java
package com.toy.nar.app.participant.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.toy.nar.domain.participant.entity.Player;
import com.toy.nar.domain.participant.entity.Team;
import com.toy.nar.domain.participant.repository.PlayerRepository;
import com.toy.nar.domain.participant.repository.TeamRepository;

@ExtendWith(MockitoExtension.class)
class PlayerAdminServiceTest {

	@Mock
	private PlayerRepository playerRepository;
	@Mock
	private TeamRepository teamRepository;
	@InjectMocks
	private PlayerAdminService playerAdminService;

	@Test
	@DisplayName("LCK 출전 이력 없는 선수는 수정 거부")
	void rejectsNonLckPlayer() {
		Player player = Player.builder().name("lplOnly").build();
		when(playerRepository.findById(1L)).thenReturn(Optional.of(player));
		when(playerRepository.hasLeagueParticipation(1L, "LCK")).thenReturn(false);

		assertThatThrownBy(() -> playerAdminService.update(1L, "img.png", null, null))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("LCK");
	}

	@Test
	@DisplayName("이미지 수정 시 잠금, 팀 변경 시 currentTeam 교체")
	void updatesImageAndTeam() {
		Player player = Player.builder().name("Faker").build();
		Team team = Team.builder().name("Gen.G").build();
		when(playerRepository.findById(1L)).thenReturn(Optional.of(player));
		when(playerRepository.hasLeagueParticipation(1L, "LCK")).thenReturn(true);
		when(teamRepository.findById(2L)).thenReturn(Optional.of(team));

		Player updated = playerAdminService.update(1L, "manual.png", null, 2L);

		assertThat(updated.getImageUrl()).isEqualTo("manual.png");
		assertThat(updated.isImageLocked()).isTrue();
		assertThat(updated.getCurrentTeam()).isEqualTo(team);
	}

	@Test
	@DisplayName("unlockImage=true면 잠금 해제(이미지 값은 유지)")
	void unlocksImage() {
		Player player = Player.builder().name("Faker").build();
		player.overrideImage("manual.png");
		when(playerRepository.findById(1L)).thenReturn(Optional.of(player));
		when(playerRepository.hasLeagueParticipation(1L, "LCK")).thenReturn(true);

		Player updated = playerAdminService.update(1L, null, true, null);

		assertThat(updated.isImageLocked()).isFalse();
		assertThat(updated.getImageUrl()).isEqualTo("manual.png");
	}
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.app.participant.service.PlayerAdminServiceTest"`
Expected: 컴파일 에러(클래스 미존재) — FAIL.

- [ ] **Step 3: PlayerAdminService 구현**

```java
package com.toy.nar.app.participant.service;

import java.util.NoSuchElementException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.toy.nar.domain.participant.entity.Player;
import com.toy.nar.domain.participant.entity.Team;
import com.toy.nar.domain.participant.repository.PlayerRepository;
import com.toy.nar.domain.participant.repository.TeamRepository;

import lombok.RequiredArgsConstructor;

/**
 * 백오피스 선수 수정. LCK 출전 이력이 있는 선수만 허용(서버 강제 — UI 필터만 믿지 않는다).
 * 이미지 수정은 overrideImage로 잠금까지 걸어 자동 동기화 덮어쓰기를 차단한다.
 */
@Service
@RequiredArgsConstructor
public class PlayerAdminService {

	private static final String EDITABLE_LEAGUE = "LCK";

	private final PlayerRepository playerRepository;
	private final TeamRepository teamRepository;

	@Transactional
	public Player update(Long playerId, String imageUrl, Boolean unlockImage, Long currentTeamId) {
		Player player = playerRepository.findById(playerId)
				.orElseThrow(() -> new NoSuchElementException("선수를 찾을 수 없습니다: " + playerId));
		if (!playerRepository.hasLeagueParticipation(playerId, EDITABLE_LEAGUE)) {
			throw new IllegalStateException("LCK 출전 이력이 있는 선수만 수정할 수 있습니다");
		}
		if (Boolean.TRUE.equals(unlockImage)) {
			player.unlockImage();
		} else if (imageUrl != null && !imageUrl.isBlank()) {
			player.overrideImage(imageUrl.trim());
		}
		if (currentTeamId != null) {
			Team team = teamRepository.findById(currentTeamId)
					.orElseThrow(() -> new NoSuchElementException("팀을 찾을 수 없습니다: " + currentTeamId));
			player.changeCurrentTeam(team);
		}
		return player;
	}
}
```

- [ ] **Step 4: MemberDeleteService 구현**

```java
package com.toy.nar.app.member.service;

import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.toy.nar.domain.member.repository.MemberRepository;

import lombok.RequiredArgsConstructor;

/**
 * 백오피스 회원 삭제. member_id FK로 참조하는 자식 테이블을 먼저 지우고 회원을 지운다.
 * ponytail: 자식 테이블 목록 하드코딩. member 참조 엔티티가 늘면 여기에도 추가해야 한다
 * (누락 시 FK 위반 → 컨트롤러에서 409로 표면화되므로 조용히 깨지진 않는다).
 */
@Service
@RequiredArgsConstructor
public class MemberDeleteService {

	// 삭제 순서 무관(모두 member_id 직접 참조, 상호 FK 없음).
	private static final List<String> MEMBER_CHILD_TABLES = List.of(
			"refresh_token",
			"member_social",
			"member_device",
			"member_favorite_player",
			"member_notification",
			"member_match_subscription",
			"member_team_notification_subscription",
			"player_solo_rank_push_delivery",
			"member_team_event_push_delivery",
			"live_player_rating");

	private final JdbcTemplate jdbcTemplate;
	private final MemberRepository memberRepository;

	@Transactional
	public void delete(Long memberId) {
		if (!memberRepository.existsById(memberId)) {
			throw new NoSuchElementException("회원을 찾을 수 없습니다: " + memberId);
		}
		for (String table : MEMBER_CHILD_TABLES) {
			jdbcTemplate.update("DELETE FROM " + table + " WHERE member_id = ?", memberId);
		}
		memberRepository.deleteById(memberId);
	}
}
```

구현 전 자식 테이블 목록 검증(누락 방지):
Run: `grep -rln 'JoinColumn(name = "member_id"' /Users/changha/dev/nar/src/main/java/com/toy/nar/domain | xargs grep -l "@Entity"`
Expected: 위 10개 엔티티 파일. 다르면 각 파일의 `@Table(name=...)`을 확인해 목록을 맞춘다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd /Users/changha/dev/nar && ./gradlew test --tests "com.toy.nar.app.participant.service.PlayerAdminServiceTest"`
Expected: PASS (3 tests).

- [ ] **Step 6: 커밋**

```bash
cd /Users/changha/dev/nar
git add src/main/java/com/toy/nar/app/participant/service/PlayerAdminService.java src/main/java/com/toy/nar/app/member/service/MemberDeleteService.java src/test/java/com/toy/nar/app/participant/service/PlayerAdminServiceTest.java
git commit -m "feat: 백오피스 선수 수정(LCK 한정)·회원 삭제 서비스

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: BackofficeController — PUT/DELETE 엔드포인트 + PlayerRow 확장

**Files:**
- Modify: `/Users/changha/dev/nar/src/main/java/com/toy/nar/api/admin/BackofficeController.java`

**Interfaces:**
- Consumes: Task 4의 `PlayerAdminService.update(...)`, `MemberDeleteService.delete(...)`.
- Produces (프론트가 소비하는 API 계약):
  - `GET /api/admin/players` 응답 행: `{ id, name, realName, role, age, imageUrl, currentTeamId, currentTeamName, imageLocked }`
  - `PUT /api/admin/players/{id}` body `{ imageUrl?: string, unlockImage?: boolean, currentTeamId?: number }` → PlayerRow. 비LCK 400, 미존재 404.
  - `DELETE /api/admin/members/{id}` / `players/{id}` / `teams/{id}` → 204. FK 충돌 409 `{message}`, 미존재 404 `{message}`.

- [ ] **Step 1: 컨트롤러 수정**

클래스에 의존성 추가:
```java
    private final com.toy.nar.app.participant.service.PlayerAdminService playerAdminService;
    private final com.toy.nar.app.member.service.MemberDeleteService memberDeleteService;
```
(기존 import 스타일에 맞춰 상단 import 문으로 정리.)

`players` GET 매핑을 확장된 PlayerRow로 교체:
```java
    @GetMapping("/players")
    public Page<PlayerRow> players(@RequestParam(required = false) String q,
                                   @RequestParam(required = false) String league,
                                   Pageable pageable) {
        return playerRepository.searchForBackoffice(blankToNull(q), blankToNull(league), pageable)
                .map(PlayerRow::from);
    }
```

레코드 교체 및 신규 레코드/엔드포인트/예외 핸들러 추가 (기존 `PlayerRow` 레코드 삭제 후):
```java
    public record PlayerRow(Long id, String name, String realName, String role, Integer age,
                            String imageUrl, Long currentTeamId, String currentTeamName, boolean imageLocked) {
        static PlayerRow from(com.toy.nar.domain.participant.entity.Player p) {
            var team = p.getCurrentTeam();
            return new PlayerRow(p.getId(), p.getName(), p.getRealName(), p.getRole(), p.getAge(),
                    p.getImageUrl(), team != null ? team.getId() : null,
                    team != null ? team.getName() : null, p.isImageLocked());
        }
    }

    public record PlayerUpdateRequest(String imageUrl, Boolean unlockImage, Long currentTeamId) {}

    // LCK 선수 한정 수정(이미지 = 수동 잠금 동반, 소속팀 변경). 서버에서 LCK 출전 이력 검증.
    @PutMapping("/players/{id}")
    public PlayerRow updatePlayer(@PathVariable Long id, @RequestBody PlayerUpdateRequest request) {
        return PlayerRow.from(playerAdminService.update(
                id, request.imageUrl(), request.unlockImage(), request.currentTeamId()));
    }

    @DeleteMapping("/members/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMember(@PathVariable Long id) {
        memberDeleteService.delete(id);
    }

    // 선수/팀은 경기 기록(game_participants) FK가 걸리면 삭제 불가 → DataIntegrityViolation → 409.
    @DeleteMapping("/players/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePlayer(@PathVariable Long id) {
        if (!playerRepository.existsById(id)) {
            throw new NoSuchElementException("선수를 찾을 수 없습니다: " + id);
        }
        playerRepository.deleteById(id);
    }

    @DeleteMapping("/teams/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTeam(@PathVariable Long id) {
        if (!teamRepository.existsById(id)) {
            throw new NoSuchElementException("팀을 찾을 수 없습니다: " + id);
        }
        teamRepository.deleteById(id);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> onConflict() {
        return Map.of("message", "경기 기록 등 연관 데이터가 있어 삭제할 수 없습니다");
    }

    @ExceptionHandler(NoSuchElementException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> onNotFound(NoSuchElementException e) {
        return Map.of("message", e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> onBadRequest(IllegalStateException e) {
        return Map.of("message", e.getMessage());
    }
```

import 추가: `org.springframework.web.bind.annotation.DeleteMapping`, `org.springframework.web.bind.annotation.ExceptionHandler`, `org.springframework.web.bind.annotation.ResponseStatus`, `org.springframework.http.HttpStatus`, `org.springframework.dao.DataIntegrityViolationException`, `java.util.Map`, `java.util.NoSuchElementException`.
클래스 javadoc의 "쓰기는 리그 설정 토글만 존재" 문장을 "쓰기: 리그 설정 토글, LCK 선수 수정(PUT /players/{id}), 회원/선수/팀 삭제(DELETE)"로 갱신.
주의: JPA 삭제는 `deleteById`가 영속성 컨텍스트 경유라 FK 위반이 flush 시점에 터진다 — `@ResponseStatus` 메서드는 트랜잭션이 컨트롤러 밖(리포지토리 기본 트랜잭션)에서 끝나므로 예외가 `DataIntegrityViolationException`으로 도착하는지 Step 3에서 실제 확인할 것.

- [ ] **Step 2: 전체 빌드/테스트**

Run: `cd /Users/changha/dev/nar && ./gradlew build -x test && ./gradlew test --tests "com.toy.nar.domain.participant.*" --tests "com.toy.nar.app.participant.*"`
Expected: BUILD SUCCESSFUL, 테스트 PASS.

- [ ] **Step 3: 수동 스모크 (로컬 백엔드 기동 가능한 경우에만; 불가하면 건너뛰고 사용자에게 보고)**

로컬 기동(별도 셸): `cd /Users/changha/dev/nar && ./gradlew bootRun --args='--spring.profiles.active=dev'`
```bash
TOKEN=<admin JWT>
# 목록에 새 필드 확인
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/admin/players?league=LCK&size=2" | python3 -m json.tool
# 경기 기록 있는 선수 삭제 → 409 확인
curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/admin/players/1"
```
Expected: 목록 행에 `imageUrl`, `currentTeamName`, `imageLocked` 존재. 삭제는 `409`.

- [ ] **Step 4: 커밋**

```bash
cd /Users/changha/dev/nar
git add src/main/java/com/toy/nar/api/admin/BackofficeController.java
git commit -m "feat: 백오피스 선수 수정 PUT·회원/선수/팀 삭제 DELETE 엔드포인트

선수 행에 imageUrl·currentTeam·imageLocked 노출. FK 충돌은 409 {message}로 응답.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Part B — 프론트 (`/Users/changha/dev/warding-backoffice-fe`)

### Task 6: dataProvider — deleteOne 구현 + 204/에러 메시지 처리

**Files:**
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/providers/data.ts`

**Interfaces:**
- Produces: Refine `useDelete()` 동작. 에러 객체 `message`에 백엔드 `{message}` 본문이 실림(409 안내 토스트용).

- [ ] **Step 1: http() 에러/204 처리 보강 및 deleteOne 구현**

`http` 함수의 `if (!res.ok)` 블록과 마지막 return을 다음으로 교체:

```ts
  if (!res.ok) {
    // 백엔드 예외 핸들러는 { message } JSON을 준다(409/404/400). 없으면 상태줄 사용.
    let message = `${res.status} ${res.statusText} — ${url}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // JSON 아님 — 상태줄 유지
    }
    throw Object.assign(new Error(message), { statusCode: res.status });
  }
  if (res.status === 204) return null; // DELETE 응답
  return res.json();
```

`create` 차단은 유지하고, `deleteOne`을 교체:

```ts
  create: () => Promise.reject(new Error("백오피스에서 생성은 지원하지 않습니다")),
  update: async ({ resource, id, variables }) => ({
    data: await http(`/api/admin/${resource}/${id}`, undefined, {
      method: "PUT",
      body: variables,
    }),
  }),
  deleteOne: async ({ resource, id }) => {
    await http(`/api/admin/${resource}/${id}`, undefined, { method: "DELETE", body: undefined });
    return { data: { id } as never };
  },
```

주의: `http`의 `init` 존재 시 `Content-Type: application/json` 헤더가 붙는다 — DELETE(body 없음)에도 무해하므로 그대로 둔다.
파일 상단 주석의 "조회 전용" 문구를 "조회 + update/delete (create만 차단)"로 갱신.

- [ ] **Step 2: 빌드 확인**

Run: `cd /Users/changha/dev/warding-backoffice-fe && npm run build`
Expected: 성공 (tsc 통과).

- [ ] **Step 3: 커밋**

```bash
cd /Users/changha/dev/warding-backoffice-fe
git add src/providers/data.ts
git commit -m "feat: dataProvider deleteOne 구현 및 204·에러 메시지 처리

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 검색형 리그 콤보박스 (기본 LCK)

**Files:**
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/components/league-select.tsx`
- Create(생성됨): `src/components/ui/command.tsx`, `src/components/ui/popover.tsx` (shadcn CLI)
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/pages/players/list.tsx`
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/pages/teams/list.tsx`

**Interfaces:**
- Produces: `<LeagueSelect value={league} onChange={(league: string) => void} />` — 검색 가능 콤보박스. `""` = 전체. **controlled 컴포넌트로 변경**(기본값은 페이지가 `useState("LCK")`로 소유).

- [ ] **Step 1: shadcn 컴포넌트 추가**

Run: `cd /Users/changha/dev/warding-backoffice-fe && npx shadcn@latest add command popover`
Expected: `src/components/ui/command.tsx`, `src/components/ui/popover.tsx` 생성, `cmdk` 의존성 추가.

- [ ] **Step 2: league-select.tsx를 콤보박스로 교체**

```tsx
import { useState } from "react";
import { useList } from "@refinedev/core";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 리그 필터 콤보박스(검색 가능). 옵션은 GET /api/admin/leagues (distinct 문자열 배열).
// controlled: 선택값은 부모(페이지)가 소유 — 기본 LCK 은 페이지의 초기 상태로 설정한다.
// value "" = 전체(필터 해제).
export function LeagueSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (league: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { result } = useList({ resource: "leagues", pagination: { mode: "off" } });
  const leagues = (result?.data ?? []) as unknown as string[];
  const options = ["", ...leagues]; // "" = 전체

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[160px] justify-between">
          {value === "" ? "리그 전체" : value}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[160px] p-0">
        <Command>
          <CommandInput placeholder="리그 검색" />
          <CommandList>
            <CommandEmpty>결과 없음</CommandEmpty>
            <CommandGroup>
              {options.map((l) => (
                <CommandItem
                  key={l || "ALL"}
                  value={l || "전체"}
                  onSelect={() => {
                    onChange(l);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value === l ? "opacity-100" : "opacity-0")} />
                  {l === "" ? "리그 전체" : l}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: players/teams 페이지에 기본 LCK 필터 연결**

`src/pages/players/list.tsx` — `useTable`에 초기 필터 추가 + 리그 상태 소유(팀 페이지도 동일 패턴):

```tsx
export const PlayerList = () => {
  const [league, setLeague] = useState("LCK"); // 기본 LCK — 리그가 많아 초기 화면을 좁힌다
  // 기본 정렬: 선수명 가나다/알파벳순
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Player>({
      resource: "players",
      sorters: { initial: [{ field: "name", order: "asc" }] },
      filters: { initial: [{ field: "league", operator: "eq", value: "LCK" }] },
    });

  const changeLeague = (next: string) => {
    setLeague(next);
    setFilters([{ field: "league", operator: "eq", value: next }]);
  };
  ...
      filterSlot={<LeagueSelect value={league} onChange={changeLeague} />}
```

`import { useState } from "react";` 추가. 검색(`onSearch`)은 기존처럼 `q` 필터만 set — Refine `setFilters`는 기본 merge 동작이라 리그 필터가 유지된다(동작 확인: 리그 LCK 선택 후 검색해도 URL에 `league=LCK`가 남아야 정상).
`src/pages/teams/list.tsx`도 동일하게 적용.

- [ ] **Step 4: 빌드 + 수동 확인**

Run: `npm run build` → 성공.
Run(로컬 백엔드 있으면): `npm run dev` 후 `/players` 접속.
Expected: 첫 화면부터 LCK 선수만. 콤보박스 타이핑으로 리그 필터링. "리그 전체" 선택 시 전체 조회.

- [ ] **Step 5: 커밋**

```bash
git add src/components/league-select.tsx src/components/ui/command.tsx src/components/ui/popover.tsx src/pages/players/list.tsx src/pages/teams/list.tsx package.json package-lock.json
git commit -m "feat: 리그 필터를 검색형 콤보박스로 교체하고 기본값 LCK 적용

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 공용 삭제 버튼 + 가입자/팀/선수 삭제

**Files:**
- Create: `/Users/changha/dev/warding-backoffice-fe/src/components/delete-row-button.tsx`
- Create(생성됨): `src/components/ui/alert-dialog.tsx` (shadcn CLI)
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/pages/members/list.tsx`
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/pages/teams/list.tsx`
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/pages/players/list.tsx`

**Interfaces:**
- Consumes: Task 6 `deleteOne`(에러 message에 서버 안내문).
- Produces: `<DeleteRowButton resource="members" id={row.id} label={row.name} />` — 확인 다이얼로그 후 삭제, 실패 시 서버 메시지 토스트.

- [ ] **Step 1: shadcn alert-dialog 추가**

Run: `cd /Users/changha/dev/warding-backoffice-fe && npx shadcn@latest add alert-dialog`
Expected: `src/components/ui/alert-dialog.tsx` 생성.

- [ ] **Step 2: DeleteRowButton 작성**

```tsx
import { useDelete } from "@refinedev/core";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// 행 삭제 버튼(확인 다이얼로그 포함). 실패(409 등)는 서버 { message } 를 그대로 토스트에 노출.
export function DeleteRowButton({
  resource,
  id,
  label,
}: {
  resource: string;
  id: number | string;
  label: string;
}) {
  const { mutate, mutation } = useDelete();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={mutation.isPending} aria-label="삭제">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>정말 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            “{label}” 을(를) 삭제합니다. 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              mutate({
                resource,
                id,
                successNotification: () => ({ message: "삭제 완료", type: "success" }),
                errorNotification: (error) => ({
                  message: "삭제 실패",
                  description: error?.message ?? "잠시 후 다시 시도해 주세요",
                  type: "error",
                }),
              })
            }
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

주의: Refine v5에서 `useDelete()` 반환이 `{ mutate, mutation }` 형태(`mutation.isPending`)인지 확인 — 다르면(`{ mutate, isPending }` 등) 그에 맞춘다(CLAUDE.md의 v5 API 함정 참조).

- [ ] **Step 3: 세 목록 페이지에 관리 컬럼 추가**

`members/list.tsx` columns 배열 끝에 추가:
```tsx
  {
    key: "actions",
    title: "관리",
    render: (row) => <DeleteRowButton resource="members" id={row.id} label={row.name} />,
  },
```
`teams/list.tsx`도 동일(`resource="teams"`, `label={row.name}`).
`players/list.tsx`는 Task 9에서 수정/삭제를 한 컬럼에 함께 넣으므로 여기서는 건너뜀.
각 파일에 `import { DeleteRowButton } from "@/components/delete-row-button";` 추가. columns 정의가 컴포넌트 밖 상수면 그대로 두어도 된다(렌더 함수는 순수).

- [ ] **Step 4: 빌드 + 수동 확인**

Run: `npm run build` → 성공.
로컬 확인 가능 시: 가입자 삭제 → 성공 토스트 + 목록 리페치. 경기 기록 있는 팀 삭제 → "경기 기록 등 연관 데이터가 있어 삭제할 수 없습니다" 토스트.

- [ ] **Step 5: 커밋**

```bash
git add src/components/delete-row-button.tsx src/components/ui/alert-dialog.tsx src/pages/members/list.tsx src/pages/teams/list.tsx
git commit -m "feat: 가입자·팀 목록 행 삭제(확인 다이얼로그, 409 안내)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 선수 목록 — 이미지·소속팀 컬럼 + LCK 한정 수정 UI

**Files:**
- Modify: `/Users/changha/dev/warding-backoffice-fe/src/pages/players/list.tsx`
- Create: `/Users/changha/dev/warding-backoffice-fe/src/pages/players/edit-dialogs.tsx`
- Create(생성됨): `src/components/ui/dialog.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/label.tsx` (shadcn CLI)

**Interfaces:**
- Consumes: Task 5 API 계약(PlayerRow 확장 필드, PUT body), Task 7 `LeagueSelect`/`league` 상태, Task 8 `DeleteRowButton`.
- Produces: 선수 목록에 이미지/소속팀 컬럼. 리그 필터가 LCK일 때 행별 [팀 변경] [이미지 수정] [삭제] 액션.

- [ ] **Step 1: shadcn 컴포넌트 추가**

Run: `cd /Users/changha/dev/warding-backoffice-fe && npx shadcn@latest add dialog checkbox label`

- [ ] **Step 2: edit-dialogs.tsx 작성 (팀 변경 + 이미지 수정 다이얼로그)**

```tsx
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
```

주의: `useUpdate()` 반환 형태(`{ mutate, mutation }`)는 Task 8과 동일하게 실제 v5 API로 확인 후 맞춘다.

- [ ] **Step 3: players/list.tsx 컬럼·액션 확장**

Player 타입을 export로 바꾸고 필드 추가, 컬럼에 이미지/소속팀/관리 추가:

```tsx
import { useState } from "react";
import { useTable } from "@refinedev/core";
import { Lock } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { LeagueSelect } from "@/components/league-select";
import { DeleteRowButton } from "@/components/delete-row-button";
import { TeamChangeDialog, ImageEditDialog } from "./edit-dialogs";

export type Player = {
  id: number;
  name: string;
  realName: string;
  role: string;
  age: number;
  imageUrl: string | null;
  currentTeamId: number | null;
  currentTeamName: string | null;
  imageLocked: boolean;
};

export const PlayerList = () => {
  const [league, setLeague] = useState("LCK"); // 기본 LCK (Task 7)
  const { result, tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageCount } =
    useTable<Player>({
      resource: "players",
      sorters: { initial: [{ field: "name", order: "asc" }] },
      filters: { initial: [{ field: "league", operator: "eq", value: "LCK" }] },
    });

  const changeLeague = (next: string) => {
    setLeague(next);
    setFilters([{ field: "league", operator: "eq", value: next }]);
  };

  // 수정(팀/이미지)은 LCK 선수 한정. UI 는 리그 필터가 LCK 일 때만 노출하고, 서버도 재검증한다.
  const editable = league === "LCK";

  const columns: Column<Player>[] = [
    { key: "id", title: "ID", sortable: true },
    {
      key: "imageUrl",
      title: "이미지",
      render: (row) => (
        <span className="flex items-center gap-1">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.name} className="size-8 rounded-full object-cover" />
          ) : (
            <span className="size-8 rounded-full bg-muted inline-block" />
          )}
          {row.imageLocked && <Lock className="size-3 text-muted-foreground" aria-label="수동 고정" />}
        </span>
      ),
    },
    { key: "name", title: "선수명", sortable: true },
    { key: "realName", title: "실명" },
    { key: "currentTeamName", title: "소속팀", render: (row) => row.currentTeamName ?? "-" },
    { key: "role", title: "포지션" },
    { key: "age", title: "나이", sortable: true },
    {
      key: "actions",
      title: "관리",
      render: (row) => (
        <span className="flex items-center">
          {editable && <TeamChangeDialog player={row} />}
          {editable && <ImageEditDialog player={row} />}
          <DeleteRowButton resource="players" id={row.id} label={row.name} />
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">선수</h1>
      <DataTable
        columns={columns}
        rows={result?.data ?? []}
        rowKey="id"
        isLoading={tableQuery.isLoading}
        sorters={sorters}
        setSorters={setSorters}
        pagination={{ currentPage, pageCount, setCurrentPage }}
        onSearch={(q) => setFilters([{ field: "q", operator: "contains", value: q }])}
        searchPlaceholder="선수명·실명 검색"
        filterSlot={<LeagueSelect value={league} onChange={changeLeague} />}
      />
    </section>
  );
};
```

(columns가 `editable`에 의존하므로 컴포넌트 안으로 이동 — 위 코드 그대로.)

- [ ] **Step 4: 빌드 + 수동 확인**

Run: `npm run build` → 성공.
로컬 확인 가능 시: LCK 목록에서 이미지·소속팀 표시. 팀 변경 저장 → 소속팀 갱신. 이미지 저장 → 잠금 아이콘 표시. 리그를 LPL로 바꾸면 수정 버튼 사라지고 삭제만 남음.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/players/list.tsx src/pages/players/edit-dialogs.tsx src/components/ui/dialog.tsx src/components/ui/checkbox.tsx src/components/ui/label.tsx package.json package-lock.json
git commit -m "feat: 선수 목록 이미지·소속팀 표시 및 LCK 선수 팀 변경/이미지 수정

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: 문서 갱신 + 최종 검증

**Files:**
- Modify: `/Users/changha/dev/warding-backoffice-fe/CLAUDE.md`

- [ ] **Step 1: CLAUDE.md 갱신**

- "무엇인가" 섹션: "조회 + 제한적 수정" → "조회 + 수정/삭제(가입자·선수·팀 삭제, LCK 선수 팀 이동/이미지 수정, 리그 설정 토글). create만 없음."
- "구조" 표: `data.ts` 행의 "getList/getOne/getMany/update만 구현, create/deleteOne 차단" → "create만 차단". `league-select.tsx`(검색형 콤보박스, 기본 LCK), `delete-row-button.tsx`, `pages/players/edit-dialogs.tsx` 행 추가.
- "보안" 섹션: "dataProvider의 create/deleteOne 차단은 의도된 설계" → "dataProvider의 create 차단은 의도된 설계". 추가: "선수 수정은 서버가 LCK 출전 이력 재검증 — 프론트 필터를 보안 경계로 취급하지 말 것."
- "함정" 섹션에 추가: "**수동 수정한 선수 이미지는 `image_locked`로 보호됨** — 자동 동기화가 못 덮는다. 팀 메타데이터(name/code/imageUrl)는 여전히 매일 04:15 sync가 덮어씀(팀 수정 기능 없는 이유). 선수 `current_team_id`는 sync 무관(수동 전용)."
- "관련 레포" admin API 목록에 PUT/DELETE 추가.

- [ ] **Step 2: 양쪽 최종 검증**

Run: `cd /Users/changha/dev/nar && ./gradlew build` → BUILD SUCCESSFUL (전체 테스트 포함).
Run: `cd /Users/changha/dev/warding-backoffice-fe && npm run build` → 성공.

- [ ] **Step 3: 커밋**

```bash
cd /Users/changha/dev/warding-backoffice-fe
git add CLAUDE.md
git commit -m "docs: 쓰기 기능(삭제·LCK 선수 수정) 반영해 CLAUDE.md 갱신

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 사용자 보고 사항**

- 백엔드 배포가 프론트보다 먼저 나가야 함(프론트가 새 필드/엔드포인트에 의존).
- V54 마이그레이션은 prod 배포 시 자동 적용(Flyway) — `players` 테이블 ALTER + 백필 UPDATE 1회.
- 팀 메타데이터(이름/코드/이미지)는 여전히 sync가 덮어씀 — 팀 수정 기능은 이번 범위 밖(필요 시 별도 요청).
