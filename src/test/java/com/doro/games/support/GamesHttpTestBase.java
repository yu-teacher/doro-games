package com.doro.games.support;

import com.hunnit_beasts.doro.sdk.security.jwks.JwksKeyProvider;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인증된 HTTP 테스트의 공통 기반. 실제 DB·Guard 를 쓰고, 운영처럼 게이트웨이가 붙여 주는 {@code Authorization: Bearer} 로 요청을 인증한다
 * (로그인·세션은 별도 BFF 가 하므로 이 서비스에는 로그인 흐름이 없다). 토큰은 가짜 IAM 서명 키로 만들고 JWKS 에 그 공개 키를 등록한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class GamesHttpTestBase {

    protected static final String CLIENT_ID = "doro-games";

    protected static final FakeIam IAM = new FakeIam();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("doro.iam.revocation-check", () -> "OFF");
    }

    @Autowired protected MockMvc mockMvc;
    @Autowired private JwksKeyProvider jwks;

    @BeforeEach
    void registerIamKey() {
        jwks.registerKey(FakeIam.KID, IAM.publicKey());
    }

    // ------------------------------------------------------------------ 도우미

    protected ResultActions send(TestUser user, AbstractMockHttpServletRequestBuilder<?> request) throws Exception {
        return mockMvc.perform(user.sign(request));
    }

    /** 판을 시작하고 runId 를 돌려준다. */
    protected String startRun(TestUser user, String slug) throws Exception {
        String body = send(user, post("/api/v1/games/{s}/runs", slug)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.data.runId");
    }

    /** 로그인한 테스트 사용자. 게이트웨이가 붙여 주는 것과 같은 Bearer 토큰으로 요청을 인증한다. */
    public record TestUser(UUID id, String email, String accessToken) {

        public RequestBuilder sign(AbstractMockHttpServletRequestBuilder<?> request) {
            request.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
            return request;
        }
    }

    /** 새 사용자를 만든다. 운영의 로그인 직후처럼 세션 조회를 한 번 불러 게임 사용자 행을 만든다. */
    protected TestUser newUser() throws Exception {
        UUID id = UUID.randomUUID();
        String email = newEmail();
        TestUser user = new TestUser(id, email, IAM.accessToken(id, email, CLIENT_ID));
        send(user, get("/api/v1/bff/session")).andExpect(status().isOk()).andExpect(jsonPath("$.data.authenticated").value(true));
        return user;
    }

    protected String newEmail() {
        return "games-" + UUID.randomUUID().toString().substring(0, 8) + "@doro.local";
    }
}
