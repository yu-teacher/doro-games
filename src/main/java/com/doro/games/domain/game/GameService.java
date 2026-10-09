package com.doro.games.domain.game;

import com.doro.games.common.exception.ErrorCode;
import com.doro.games.common.exception.GamesException;
import com.doro.games.domain.game.GameDtos.GameHighlight;
import com.doro.games.domain.game.GameDtos.GameResponse;
import com.doro.games.domain.game.GameDtos.LeaderboardEntry;
import com.doro.games.domain.game.GameDtos.LeaderboardResponse;
import com.doro.games.domain.game.GameDtos.MyRecordResponse;
import com.doro.games.domain.game.GameDtos.RunResponse;
import com.doro.games.domain.game.GameDtos.SubmitScoreResponse;
import com.doro.games.domain.user.service.GameUserService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameService {

    private final GameRepository gameRepository;
    private final GameRunRepository runRepository;
    private final GameUserService userService;
    private final ScoringProperties scoring;
    private final JdbcClient jdbc;

    @Transactional(readOnly = true)
    public List<GameResponse> list() {
        return gameRepository.findByEnabledTrueOrderBySortOrderAscTitleAsc().stream().map(GameResponse::from).toList();
    }

    /** 로비용 요약. 열린 게임마다 현재 1위와 내 최고 기록·순위를 한 번의 질의로 가져온다(비로그인이면 내 기록은 비어 있다). */
    @Transactional(readOnly = true)
    public List<GameHighlight> highlights(DoroUser doroUser) {
        UUID userId = doroUser.isAuthenticated() ? doroUser.userId() : null;
        return jdbc.sql("""
                SELECT g.slug, g.title, g.description,
                       t.best_score AS top_score, t.nickname AS top_nickname,
                       m.best_score AS my_best,
                       CASE WHEN m.best_score IS NULL THEN NULL ELSE (
                           SELECT COUNT(*) + 1 FROM game_records o
                           WHERE o.game_id = g.id
                             AND (o.best_score > m.best_score OR (o.best_score = m.best_score AND o.achieved_at < m.achieved_at))
                       ) END AS my_rank
                FROM games g
                LEFT JOIN LATERAL (
                    SELECT r.best_score, u.nickname FROM game_records r JOIN game_users u ON u.id = r.user_id
                    WHERE r.game_id = g.id ORDER BY r.best_score DESC, r.achieved_at ASC LIMIT 1
                ) t ON TRUE
                LEFT JOIN game_records m ON m.game_id = g.id AND m.user_id = CAST(:userId AS uuid)
                WHERE g.enabled
                ORDER BY g.sort_order, g.title
                """)
                .param("userId", userId == null ? null : userId.toString())
                .query((rs, i) -> new GameHighlight(rs.getString("slug"), rs.getString("title"), rs.getString("description"),
                        nullableLong(rs, "top_score"), rs.getString("top_nickname"),
                        nullableLong(rs, "my_best"), nullableLong(rs, "my_rank")))
                .list();
    }

    private static Long nullableLong(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    @Transactional(readOnly = true)
    public GameResponse get(String slug) {
        return GameResponse.from(openGame(slug));
    }

    /** 운영자 전용(Guard 가 컨트롤러에서 판정한다): 게임을 열거나 닫는다. 닫힌 게임은 목록·판 시작·기록에서 빠진다. */
    @Transactional
    public GameResponse setEnabled(String slug, boolean enabled) {
        Game game = gameRepository.findBySlug(slug).orElseThrow(() -> new GamesException(ErrorCode.GAME_NOT_FOUND));
        game.changeEnabled(enabled);
        log.info("Game {} enabled={}", slug, enabled);
        return GameResponse.from(game);
    }

    @Transactional
    public RunResponse startRun(DoroUser doroUser, String slug) {
        var user = userService.getOrCreateUser(doroUser);
        Game game = openGame(slug);
        GameRun run = runRepository.save(new GameRun(UUID.randomUUID(), game.getId(), user.getId(), Instant.now()));
        return new RunResponse(run.getId(), run.getStartedAt());
    }

    /**
     * 판이 끝났을 때의 점수를 기록한다. 서버가 잰 경과 시간 안에 낼 수 있는 점수(게임별 초당 최대 점수 + 네트워크 여유)를
     * 넘으면 기록하지 않는다. 거절된 판도 닫는다(같은 판으로 값을 바꿔 가며 다시 시도하지 못하게).
     */
    @Transactional(noRollbackFor = GamesException.class)
    public SubmitScoreResponse submitScore(DoroUser doroUser, String slug, UUID runId, long score) {
        var user = userService.getOrCreateUser(doroUser);
        Game game = openGame(slug);
        GameRun run = runRepository.findByIdForUpdate(runId)
                .filter(r -> r.getUserId().equals(user.getId()) && r.getGameId().equals(game.getId()))
                .orElseThrow(() -> new GamesException(ErrorCode.RUN_NOT_FOUND));
        if (run.isFinished()) {
            throw new GamesException(ErrorCode.RUN_ALREADY_FINISHED);
        }
        Instant now = Instant.now();
        run.finish(now);

        ScoringProperties.Rule rule = scoring.rules().get(game.getSlug());
        if (rule == null) {
            log.error("No scoring rule configured for game {} - rejecting score", game.getSlug());
            throw new GamesException(ErrorCode.SCORE_REJECTED);
        }
        double elapsedSeconds = Duration.between(run.getStartedAt(), now).toMillis() / 1000.0;
        double ceiling = rule.maxPointsPerSecond() * (elapsedSeconds + scoring.networkToleranceMs() / 1000.0);
        if (score < 0 || score > GameDtos.SCORE_CAP || score > ceiling) {
            log.warn("Rejected implausible score: game={}, userId={}, score={}, elapsedSeconds={}", slug, user.getId(), score, elapsedSeconds);
            throw new GamesException(ErrorCode.SCORE_REJECTED);
        }

        // 최고 기록 한 줄을 갱신한다. 더 높을 때만 기록 시각을 새로 쓴다(같은 점수면 먼저 달성한 사람이 위).
        long best = jdbc.sql("""
                INSERT INTO game_records (game_id, user_id, best_score, plays, achieved_at, last_played_at)
                VALUES (:gameId, :userId, :score, 1, :now, :now)
                ON CONFLICT (game_id, user_id) DO UPDATE SET
                    achieved_at = CASE WHEN EXCLUDED.best_score > game_records.best_score THEN EXCLUDED.achieved_at ELSE game_records.achieved_at END,
                    best_score = GREATEST(game_records.best_score, EXCLUDED.best_score),
                    plays = game_records.plays + 1,
                    last_played_at = EXCLUDED.last_played_at
                RETURNING best_score
                """)
                .param("gameId", game.getId()).param("userId", user.getId()).param("score", score)
                .param("now", java.sql.Timestamp.from(now))
                .query(Long.class).single();
        long rank = rankOf(game.getId(), user.getId());
        log.info("Score recorded: game={}, userId={}, score={}, best={}", slug, user.getId(), score, best);
        return new SubmitScoreResponse(score, best, score == best, rank);
    }

    @Transactional(readOnly = true)
    public LeaderboardResponse leaderboard(String slug, int limit) {
        Game game = openGame(slug);
        AtomicLong rank = new AtomicLong();
        List<LeaderboardEntry> entries = jdbc.sql("""
                SELECT r.user_id, u.nickname, u.color, r.best_score, r.achieved_at
                FROM game_records r JOIN game_users u ON u.id = r.user_id
                WHERE r.game_id = :gameId
                ORDER BY r.best_score DESC, r.achieved_at ASC
                LIMIT :limit
                """)
                .param("gameId", game.getId()).param("limit", limit)
                .query((rs, i) -> new LeaderboardEntry(rank.incrementAndGet(), rs.getObject("user_id", UUID.class),
                        rs.getString("nickname"), rs.getString("color"), rs.getLong("best_score"),
                        rs.getTimestamp("achieved_at").toInstant()))
                .list();
        return new LeaderboardResponse(game.getSlug(), entries);
    }

    @Transactional(readOnly = true)
    public Optional<MyRecordResponse> myRecord(DoroUser doroUser, String slug) {
        if (!doroUser.isAuthenticated()) {
            throw new GamesException(ErrorCode.UNAUTHORIZED);
        }
        Game game = openGame(slug);
        return jdbc.sql("SELECT best_score, plays FROM game_records WHERE game_id = :g AND user_id = :u")
                .param("g", game.getId()).param("u", doroUser.userId())
                .query((rs, i) -> new long[]{rs.getLong("best_score"), rs.getLong("plays")}).optional()
                .map(row -> new MyRecordResponse(row[0], row[1], rankOf(game.getId(), doroUser.userId())));
    }

    private long rankOf(UUID gameId, UUID userId) {
        return jdbc.sql("""
                SELECT COUNT(*) + 1 FROM game_records o, game_records me
                WHERE me.game_id = :g AND me.user_id = :u AND o.game_id = :g
                  AND (o.best_score > me.best_score OR (o.best_score = me.best_score AND o.achieved_at < me.achieved_at))
                """)
                .param("g", gameId).param("u", userId)
                .query(Long.class).single();
    }

    private Game openGame(String slug) {
        return gameRepository.findBySlug(slug).filter(Game::isEnabled)
                .orElseThrow(() -> new GamesException(ErrorCode.GAME_NOT_FOUND));
    }
}
