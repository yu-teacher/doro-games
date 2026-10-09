package com.doro.games.config;

import com.doro.games.domain.auth.BffProperties;
import com.doro.games.domain.game.ScoringProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableConfigurationProperties({BffProperties.class, ScoringProperties.class})
@EnableScheduling
public class BffConfig {
}
