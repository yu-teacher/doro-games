package com.doro.games.config;

import com.doro.games.domain.game.ScoringProperties;
import com.doro.games.domain.user.sync.DeletedAccountAnonymizer;
import com.hunnit_beasts.doro.sdk.sync.DeletedUserHandler;
import com.hunnit_beasts.doro.sdk.sync.DeletedUsersProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 게임 천국 공통 설정: 점수 규칙과 탈퇴 동기화.
 * 로그인·세션·토큰 갱신은 별도 BFF(doro-bff)가 맡고 게이트웨이가 {@code Authorization: Bearer} 를 붙여 주므로,
 * 이 서비스는 SDK 의 토큰 검증만 쓴다(로그인 코드가 없다).
 */
@Configuration
@EnableConfigurationProperties(ScoringProperties.class)
@EnableScheduling
public class GamesConfig {

    /** 탈퇴 동기화 설정({@code games.deleted-sync.*}: enabled, page-size, overlap, interval, initial-delay, 타임아웃). 로직은 SDK 가 맡는다. */
    @Bean
    @ConfigurationProperties(prefix = "games.deleted-sync")
    public DeletedUsersProperties deletedUsersProperties() {
        return new DeletedUsersProperties();
    }

    /** Doro 에서 영구 탈퇴한 사용자의 게임 프로필을 익명화한다(멱등). */
    @Bean
    public DeletedUserHandler deletedUserHandler(DeletedAccountAnonymizer anonymizer) {
        return anonymizer::anonymize;
    }
}
