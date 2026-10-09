package com.doro.games.domain.game;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface GameRunRepository extends JpaRepository<GameRun, UUID> {

    /** 같은 판에 기록이 동시에 두 번 들어와도 한 번만 인정하도록 행을 잠근다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from GameRun r where r.id = :id")
    Optional<GameRun> findByIdForUpdate(@Param("id") UUID id);
}
