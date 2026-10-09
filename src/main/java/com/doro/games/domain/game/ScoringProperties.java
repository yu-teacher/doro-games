package com.doro.games.domain.game;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

/**
 * 점수 타당성 규칙. 게임 slug 별로 "1초에 낼 수 있는 최대 점수" 를 정한다(환경변수로 조정).
 * 규칙이 없는 게임은 기록을 받지 않는다(안전한 쪽으로 닫는다).
 */
@ConfigurationProperties(prefix = "games.scoring")
public record ScoringProperties(long networkToleranceMs, Map<String, Rule> rules) {

    public record Rule(double maxPointsPerSecond) {
    }

    public ScoringProperties {
        rules = rules == null ? Map.of() : Map.copyOf(rules);
    }
}
