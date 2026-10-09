package com.doro.games.domain.game;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GameRepository extends JpaRepository<Game, UUID> {

    Optional<Game> findBySlug(String slug);

    List<Game> findByEnabledTrueOrderBySortOrderAscTitleAsc();
}
