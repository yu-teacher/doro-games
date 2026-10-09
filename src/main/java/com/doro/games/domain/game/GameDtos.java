package com.doro.games.domain.game;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public final class GameDtos {

    private GameDtos() {
    }

    /** 점수는 정수. 상한은 판 시간으로 서버가 따로 검사하고, 여기서는 자료형이 넘치지 않게만 막는다. */
    public static final long SCORE_CAP = 1_000_000_000L;

    public record GameResponse(String slug, String title, String description, boolean enabled) {
        public static GameResponse from(Game game) {
            return new GameResponse(game.getSlug(), game.getTitle(), game.getDescription(), game.isEnabled());
        }
    }

    public record RunResponse(UUID runId, Instant startedAt) {
    }

    public record SubmitScoreRequest(@NotNull @Min(0) Long score) {
    }

    public record SubmitScoreResponse(long score, long best, boolean newBest, long rank) {
    }

    public record SetEnabledRequest(@NotNull Boolean enabled) {
    }

    public record LeaderboardEntry(long rank, UUID userId, String nickname, String color, long score, Instant achievedAt) {
    }

    public record LeaderboardResponse(String slug, java.util.List<LeaderboardEntry> entries) {
    }

    /** 로비 카드 한 장: 게임 정보와 현재 1위, (로그인했다면) 내 최고 기록. 기록이 없으면 해당 필드는 null. */
    public record GameHighlight(String slug, String title, String description,
                                Long topScore, String topNickname, Long myBest, Long myRank) {
    }

    public record MyRecordResponse(long best, long plays, long rank) {
    }
}
