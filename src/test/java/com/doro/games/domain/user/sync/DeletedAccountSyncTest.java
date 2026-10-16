package com.doro.games.domain.user.sync;

import com.doro.games.domain.game.GameDtos.LeaderboardEntry;
import com.doro.games.domain.game.GameService;
import com.doro.games.domain.user.service.GameUserService;
import com.doro.games.domain.user.dto.GameUserDtos.UpdateProfileRequest;
import com.doro.games.common.exception.GamesException;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import com.hunnit_beasts.doro.sdk.sync.DeletedUserHandler;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersClient;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersClient.DeletedUser;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersClient.DeletedUsersPage;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersSync;
import com.hunnit_beasts.doro.sdk.sync.SyncCursorStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

/** Doro 에서 영구 탈퇴한 사용자의 게임 프로필을 익명화하고, 주기 동기화가 안전하게 이어지는지 검증한다. */
@SpringBootTest
class DeletedAccountSyncTest {

    /** SDK 동기화가 기준 시각을 저장하는 이름(기본값). */
    private static final String STATE_NAME = "iam-deleted-users";

    @Autowired private DeletedAccountAnonymizer anonymizer;
    @Autowired private DeletedUserHandler handler;
    @Autowired private SyncCursorStore cursorStore;
    @Autowired private DeletedUsersSync sync;
    @Autowired private IamSyncStateRepository states;
    @Autowired private GameService games;
    @Autowired private GameUserService userService;
    @Autowired private JdbcTemplate jdbc;
    @MockitoBean private DeletedUsersClient iam;

    /** 이 시험이 만든 사용자. 같은 DB 를 쓰는 다른 시험의 순위표에 남지 않게 끝나면 지운다. */
    private final List<UUID> created = new ArrayList<>();

    @BeforeEach
    void resetState() {
        reset(iam);
        states.deleteAll();
    }

    @AfterEach
    void cleanUp() {
        for (UUID id : created) {
            jdbc.update("delete from game_records where user_id = ?", id);
            jdbc.update("delete from game_runs where user_id = ?", id);
            jdbc.update("delete from auth_sessions where user_id = ?", id);
            jdbc.update("delete from game_users where id = ?", id);
        }
        created.clear();
    }

    private DoroUser doroUser(UUID id) {
        return new DoroUser(id, "g_" + id.toString().substring(0, 8) + "@doro.local", UUID.randomUUID(), 100, "USER");
    }

    /** 게임 사용자 행을 만들고 runner 게임에 최고 기록을 하나 남긴다. */
    private UUID player(String nickname, long score) {
        UUID id = UUID.randomUUID();
        created.add(id);
        userService.getOrCreateUser(doroUser(id));
        jdbc.update("update game_users set nickname = ? where id = ?", nickname, id);
        jdbc.update("""
                insert into game_runs (id, game_id, user_id, started_at, finished_at)
                select ?, id, ?, now(), now() from games where slug = 'runner'
                """, UUID.randomUUID(), id);
        jdbc.update("""
                insert into game_records (game_id, user_id, best_score, plays, achieved_at, last_played_at)
                select id, ?, ?, 3, now(), now() from games where slug = 'runner'
                """, id, score);
        return id;
    }

    private Map<String, Object> gameUser(UUID id) {
        return jdbc.queryForMap("select * from game_users where id = ?", id);
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    private void insertSession(UUID userId) {
        jdbc.update("""
                insert into auth_sessions (id, session_hash, user_id, access_token_enc, access_expires_at, refresh_token_enc, expires_at)
                values (?, ?, ?, 'x', now(), 'y', now() + interval '1 day')
                """, UUID.randomUUID(), UUID.randomUUID().toString().replace("-", ""), userId);
    }

    // ---------------- 익명화 ----------------

    @Test
    @DisplayName("익명화하면 사용자명·닉네임이 바뀌고 BFF 세션은 지워지며, 판·최고 기록은 그대로 남는다")
    void anonymizesProfileAndKeepsScores() {
        UUID id = player("비밀닉네임", 4321);
        Map<String, Object> before = gameUser(id);
        insertSession(id);
        UUID other = player("친구", 100);
        insertSession(other);

        assertThat(anonymizer.anonymize(id, Instant.now())).isTrue();

        Map<String, Object> after = gameUser(id);
        assertThat(after.get("nickname")).isEqualTo("탈퇴한 사용자");
        assertThat((String) after.get("username")).isEqualTo("deleted-" + id.toString().replace("-", ""))
                .isNotEqualTo(before.get("username"));
        assertThat(after.get("deleted_at")).isNotNull();
        assertThat(after.get("color")).isEqualTo(before.get("color"));
        assertThat(count("select count(*) from auth_sessions where user_id = ?", id)).isZero();
        assertThat(count("select count(*) from game_records where user_id = ?", id)).isEqualTo(1);
        assertThat(count("select count(*) from game_runs where user_id = ?", id)).isEqualTo(1);
        // 다른 사용자는 건드리지 않는다
        assertThat(gameUser(other).get("nickname")).isEqualTo("친구");
        assertThat(count("select count(*) from auth_sessions where user_id = ?", other)).isEqualTo(1);
    }

    @Test
    @DisplayName("탈퇴 후 순위표에는 점수가 남고 이름은 '탈퇴한 사용자' 로 보인다")
    void leaderboardShowsPlaceholder() {
        UUID id = player("진짜이름", 9_000_000_000_000_000_000L);

        anonymizer.anonymize(id, Instant.now());

        LeaderboardEntry top = games.leaderboard("runner", 1).entries().get(0);
        assertThat(top.userId()).isEqualTo(id);
        assertThat(top.score()).isEqualTo(9_000_000_000_000_000_000L);
        assertThat(top.nickname()).isEqualTo("탈퇴한 사용자");
        assertThat(games.leaderboard("runner", 50).entries()).noneMatch(e -> "진짜이름".equals(e.nickname()));
        assertThat(games.highlights(doroUser(UUID.randomUUID())).stream().filter(h -> "runner".equals(h.slug())).findFirst().orElseThrow()
                .topNickname()).isEqualTo("탈퇴한 사용자");
    }

    @Test
    @DisplayName("이미 익명화했거나 게임을 해 본 적 없는 사용자에게 다시 호출해도 아무것도 바꾸지 않는다")
    void idempotentAndUnknownUsers() {
        UUID id = player("한번만", 10);
        Instant first = Instant.now().minusSeconds(60);
        assertThat(handler.onDeleted(id, first)).isTrue();
        Object deletedAt = gameUser(id).get("deleted_at");
        insertSession(id); // 재호출은 이미 처리된 사용자라 아무것도 지우지 않는다

        assertThat(handler.onDeleted(id, Instant.now())).isFalse();

        assertThat(gameUser(id).get("deleted_at")).isEqualTo(deletedAt);
        assertThat(count("select count(*) from auth_sessions where user_id = ?", id)).isEqualTo(1);
        UUID stranger = UUID.randomUUID();
        assertThat(handler.onDeleted(stranger, Instant.now())).isFalse();
        assertThat(count("select count(*) from game_users where id = ?", stranger)).isZero();
    }

    @Test
    @DisplayName("익명화된 사용자는 아직 유효한 토큰으로도 프로필(이름)을 되살릴 수 없다")
    void deletedUserCannotRestoreProfile() {
        UUID id = player("지워질이름", 1);
        anonymizer.anonymize(id, Instant.now());

        assertThatThrownBy(() -> userService.updateProfile(doroUser(id), new UpdateProfileRequest("되살림", "revived_name")))
                .isInstanceOf(GamesException.class);

        assertThat(gameUser(id).get("nickname")).isEqualTo("탈퇴한 사용자");
    }

    // ---------------- 기준 시각 저장소 ----------------

    @Test
    @DisplayName("기준 시각은 앞으로만 움직인다")
    void cursorOnlyMovesForward() {
        Instant t1 = Instant.parse("2026-10-01T00:00:00Z");
        Instant t2 = Instant.parse("2026-10-02T00:00:00Z");
        assertThat(cursorStore.get("c-test")).isEmpty();

        cursorStore.advance("c-test", t1);
        assertThat(cursorStore.get("c-test")).contains(t1);
        cursorStore.advance("c-test", t2);
        assertThat(cursorStore.get("c-test")).contains(t2);
        cursorStore.advance("c-test", t1);
        assertThat(cursorStore.get("c-test")).contains(t2);
    }

    // ---------------- 설정 연결 · 주기 동기화 ----------------

    @Test
    @DisplayName("탈퇴 동기화 빈이 등록되어 있고 핸들러가 익명화기로 이어진다")
    void wiring() {
        assertThat(handler).isNotNull();
        assertThat(sync).isNotNull();
        assertThat(cursorStore).isInstanceOf(GamesSyncCursorStore.class);
        UUID id = player("연결", 5);
        assertThat(handler.onDeleted(id, Instant.now())).isTrue();
        assertThat(gameUser(id).get("nickname")).isEqualTo("탈퇴한 사용자");
    }

    @Test
    @DisplayName("동기화는 Doro 목록의 사용자를 익명화하고 게임 사용자가 아닌 ID 는 무시하며 기준 시각을 저장한다")
    void syncAnonymizesListedUsers() {
        UUID id = player("동기화대상", 77);
        Instant deletedAt = Instant.now();
        when(iam.fetchDeletedUsers(any(), anyInt())).thenReturn(new DeletedUsersPage(
                List.of(new DeletedUser(id, deletedAt), new DeletedUser(UUID.randomUUID(), deletedAt)), deletedAt));

        assertThat(sync.sync()).isEqualTo(1);

        assertThat(gameUser(id).get("deleted_at")).isNotNull();
        assertThat(states.findById(STATE_NAME).orElseThrow().getCursorAt()).isBefore(deletedAt);
    }

    @Test
    @DisplayName("Doro 에 닿지 못하면 예외로 알리고 아무것도 바꾸지 않으며, 예약 실행은 예외를 밖으로 내지 않는다")
    void syncSurvivesIamOutage() {
        UUID id = player("장애", 1);
        when(iam.fetchDeletedUsers(any(), anyInt())).thenThrow(new IllegalStateException("iam down"));

        assertThatThrownBy(() -> sync.sync()).isInstanceOf(IllegalStateException.class);
        sync.scheduledRun();

        assertThat(gameUser(id).get("deleted_at")).isNull();
        assertThat(states.findById(STATE_NAME)).isEmpty();
    }
}
