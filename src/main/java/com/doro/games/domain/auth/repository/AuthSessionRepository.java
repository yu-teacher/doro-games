package com.doro.games.domain.auth.repository;

import com.doro.games.domain.auth.entity.AuthSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface AuthSessionRepository extends JpaRepository<AuthSession, UUID> {

    Optional<AuthSession> findBySessionHash(String sessionHash);

    @Modifying
    @Query("DELETE FROM AuthSession s WHERE s.sessionHash = :hash")
    int deleteBySessionHash(@Param("hash") String hash);

    @Modifying
    @Query("DELETE FROM AuthSession s WHERE s.expiresAt <= :now")
    int deleteExpired(@Param("now") Instant now);
}
