package com.doro.games.domain.game;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * 서버가 발급한 "판". 시작 시각을 서버가 정하므로, 제출된 점수가 그 시간 안에 낼 수 있는 값인지 서버가 따질 수 있다.
 * 한 판은 한 번만 기록을 낼 수 있다.
 */
@Entity
@Table(name = "game_runs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GameRun {

    @Id
    private UUID id;

    @Column(name = "game_id", nullable = false)
    private UUID gameId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    public GameRun(UUID id, UUID gameId, UUID userId, Instant startedAt) {
        this.id = id;
        this.gameId = gameId;
        this.userId = userId;
        this.startedAt = startedAt;
    }

    public boolean isFinished() {
        return finishedAt != null;
    }

    public void finish(Instant at) {
        this.finishedAt = at;
    }
}
