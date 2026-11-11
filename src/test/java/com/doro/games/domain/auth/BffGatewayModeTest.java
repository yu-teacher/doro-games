package com.doro.games.domain.auth;

import com.doro.games.support.GamesHttpTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.HttpHeaders;

import java.util.Arrays;
import java.util.Objects;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 로그인·세션·토큰 갱신은 별도 BFF(doro-bff)가 하고, 이 서비스에는 BFF 코드가 돌지 않는다(설정으로 고르는 모드도 없다).
 * 서비스는 게이트웨이가 붙여 주는 Bearer 만 검증하므로, 쿠키만 보내면 익명이다.
 */
class BffGatewayModeTest extends GamesHttpTestBase {

    @Autowired private ConfigurableApplicationContext context;

    @Test
    @DisplayName("SDK 의 BFF 구성 요소(저장소·컨트롤러·세션 필터)가 하나도 만들어지지 않는다")
    void noBffBeans() {
        var factory = context.getBeanFactory();
        var bffBeans = Arrays.stream(factory.getBeanDefinitionNames())
                .map(factory::getType)
                .filter(Objects::nonNull)
                .map(Class::getName)
                .filter(name -> name.startsWith("com.hunnit_beasts.doro.sdk.bff."))
                .toList();
        assertThat(bffBeans).isEmpty();
    }

    @Test
    @DisplayName("로그인·콜백·로그아웃 경로는 이 서비스에 없다(게이트웨이가 BFF 로 보낸다)")
    void loginIsNotServedHere() throws Exception {
        mockMvc.perform(get("/api/v1/bff/login")).andExpect(status().is4xxClientError());
        mockMvc.perform(get("/api/v1/bff/callback").param("code", "c").param("state", "s")).andExpect(status().is4xxClientError());
        mockMvc.perform(post("/api/v1/bff/logout")).andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("세션 조회는 이 서비스가 제공하고, Bearer 가 없으면 익명이다(쿠키는 이 서비스가 해석하지 않는다)")
    void sessionEndpointIsAnonymousWithoutBearer() throws Exception {
        mockMvc.perform(get("/api/v1/bff/session").cookie(new Cookie("doro_games_session", "whatever")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authenticated").value(false));
    }

    @Test
    @DisplayName("Bearer 가 있으면 로그인 상태와 프로필을 돌려준다")
    void sessionEndpointWithBearer() throws Exception {
        TestUser user = newUser();
        send(user, get("/api/v1/bff/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authenticated").value(true))
                .andExpect(jsonPath("$.data.user").exists());
    }

    @Test
    @DisplayName("쿠키만으로는 로그인이 필요한 API 를 쓸 수 없다")
    void cookieAloneIsNotAuthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/me").cookie(new Cookie("doro_games_session", "whatever")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("만료된 Bearer 나 다른 클라이언트용 토큰으로는 로그인 상태가 되지 않는다")
    void expiredOrForeignBearerIsNotAuthenticated() throws Exception {
        UUID id = UUID.randomUUID();
        String expired = IAM.expiredAccessToken(id, newEmail(), CLIENT_ID);
        String foreign = IAM.accessToken(id, newEmail(), "doro-blog");
        for (String token : new String[]{expired, foreign}) {
            mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                    .andExpect(status().isUnauthorized());
        }
    }
}
