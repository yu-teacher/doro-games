package com.doro.games.config;

import com.doro.games.domain.game.ScoringProperties;
import com.doro.games.domain.user.service.GameUserService;
import com.hunnit_beasts.doro.sdk.bff.BffProperties;
import com.hunnit_beasts.doro.sdk.bff.BffUserHook;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * BFF 로그인 설정. {@code games.auth.mode} 가 {@code gateway} 면 로그인·세션·토큰 갱신을 별도 서비스(doro-bff)가 맡고
 * 게이트웨이가 {@code Authorization: Bearer} 를 붙여 주므로 이 서비스에는 아래 BFF 빈이 만들어지지 않는다. {@code embedded}(기본)면 로그인 로직(세션·로그인 CSRF·토큰 갱신·로그아웃)은 SDK(doro-sdk 의 bff 패키지)가 맡고, 게임 천국은 설정 값과
 * 저장소({@link com.doro.games.domain.auth.GamesBffStores}), 로그인 직후의 사용자 생성만 제공한다.
 * 설정 키는 그대로 {@code games.auth.*}, 환경변수 이름도 그대로다.
 */
@Configuration
@EnableConfigurationProperties(ScoringProperties.class)
@EnableScheduling
public class GamesBffConfig {

    /** 게임 천국의 기본값을 깔고 {@code games.auth.*} 설정이 그 위에 덮어쓴다. */
    @Bean
    @ConditionalOnEmbeddedBff
    @ConfigurationProperties(prefix = "games.auth")
    public BffProperties bffProperties() {
        return defaults();
    }

    /** 이 서비스의 기본값(SDK 의 일반 기본값과 다른 부분). 시험도 같은 기본값을 쓴다. */
    public static BffProperties defaults() {
        BffProperties props = new BffProperties();
        props.setClientId("doro-games");
        props.setCookieName("doro_games_session");
        props.setLoginCookieName("doro_games_login");
        props.setCsrfHeader("X-Games-Csrf");
        // 게임 천국 웹은 라우터 기준 경로(/g/2048)를 보내고, 서버가 웹 기준 경로(/games)를 붙여 이동시킨다.
        props.setReturnPathRelativeToWebBase(true);
        props.setRedirectUri("http://localhost:5173/api/v1/bff/callback");
        return props;
    }

    /** 로그인에 성공하면 게임 사용자 행을 만들거나 갱신한다. */
    @Bean
    @ConditionalOnEmbeddedBff
    public BffUserHook bffUserHook(GameUserService userService) {
        return user -> userService.getOrCreateUser(user);
    }
}
