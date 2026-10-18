package com.doro.games.domain.game;

import com.doro.games.support.GamesHttpTestBase;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 게임 목록·판 시작·점수 제출·랭킹. 점수는 서버가 발급한 판과 경과 시간으로만 인정한다. */
class GameHttpTest extends GamesHttpTestBase {

    private static final String RUNNER = "runner";

    private ResultActions submit(TestUser user, String runId, long score) throws Exception {
        return send(user, post("/api/v1/games/{s}/runs/{r}/score", RUNNER, runId)
                .contentType(MediaType.APPLICATION_JSON).content("{\"score\":" + score + "}"));
    }

    @Test
    @DisplayName("게임 목록과 랭킹은 로그인 없이 볼 수 있다")
    void catalogIsPublic() throws Exception {
        mockMvc.perform(get("/api/v1/games")).andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[?(@.slug=='runner')]").exists());
        mockMvc.perform(get("/api/v1/games/runner")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/games/runner/leaderboard")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/games/nope")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME-404-01"));
    }

    @Test
    @DisplayName("로그인하지 않으면 판을 시작할 수도 점수를 낼 수도 없다(401)")
    void requiresLogin() throws Exception {
        mockMvc.perform(post("/api/v1/games/runner/runs")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/games/runner/me")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("판을 시작하고 시간 안에 낼 수 있는 점수를 내면 기록과 순위가 생긴다")
    void submitPlausibleScore() throws Exception {
        TestUser user = newUser();
        String runId = startRun(user, RUNNER);

        // 네트워크 여유 시간 안에서는 몇십 점은 낼 수 있다
        submit(user, runId, 20).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.score").value(20))
                .andExpect(jsonPath("$.data.best").value(20))
                .andExpect(jsonPath("$.data.newBest").value(true))
                .andExpect(jsonPath("$.data.rank").isNumber());

        send(user, get("/api/v1/games/runner/me")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.best").value(20)).andExpect(jsonPath("$.data.plays").value(1));
    }

    @Test
    @DisplayName("판 시간으로 낼 수 없는 점수는 400 으로 거절하고, 그 판은 다시 쓸 수 없다")
    void rejectsImplausibleScore() throws Exception {
        TestUser user = newUser();
        String runId = startRun(user, RUNNER);

        submit(user, runId, 1_000_000).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SCORE-400-01"));
        // 거절된 판으로 값을 낮춰 다시 시도하지 못한다
        submit(user, runId, 1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("RUN-409-01"));
        send(user, get("/api/v1/games/runner/me")).andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("한 판에는 한 번만 제출할 수 있고, 남의 판으로는 제출할 수 없다")
    void runIsSingleUseAndOwned() throws Exception {
        TestUser alice = newUser();
        TestUser bob = newUser();
        String runId = startRun(alice, RUNNER);

        submit(bob, runId, 1).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RUN-404-01"));
        submit(alice, runId, 5).andExpect(status().isOk());
        submit(alice, runId, 6).andExpect(status().isConflict());
    }

    @Test
    @DisplayName("최고 기록만 남고 랭킹은 높은 점수 순이다")
    void bestScoreAndLeaderboard() throws Exception {
        TestUser user = newUser();
        submit(user, startRun(user, RUNNER), 30).andExpect(status().isOk());
        submit(user, startRun(user, RUNNER), 10).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.best").value(30)).andExpect(jsonPath("$.data.newBest").value(false));

        send(user, get("/api/v1/games/runner/me")).andExpect(jsonPath("$.data.best").value(30)).andExpect(jsonPath("$.data.plays").value(2));

        String body = mockMvc.perform(get("/api/v1/games/runner/leaderboard").param("limit", "100"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        java.util.List<Integer> scores = JsonPath.read(body, "$.data.entries[*].score");
        assertThat(scores).isSortedAccordingTo(java.util.Comparator.reverseOrder());
        java.util.List<String> nicknames = JsonPath.read(body, "$.data.entries[*].nickname");
        assertThat(nicknames).isNotEmpty();
        // 이메일 같은 계정 정보는 랭킹에 나오지 않는다
        assertThat(body).doesNotContain(user.email());
    }

    @Test
    @DisplayName("랭킹 개수 파라미터가 범위를 벗어나면 400")
    void leaderboardLimitValidation() throws Exception {
        mockMvc.perform(get("/api/v1/games/runner/leaderboard").param("limit", "0")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/games/runner/leaderboard").param("limit", "101")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("게임을 여닫는 일은 운영자(Guard manager)만 할 수 있다")
    void onlyManagerCanToggle() throws Exception {
        TestUser user = newUser();
        send(user, patch("/api/v1/games/runner").contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/v1/games/runner").contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("로비 요약은 비로그인이면 1위만, 로그인하면 내 최고 기록과 순위도 준다")
    void highlights() throws Exception {
        TestUser user = newUser();
        submit(user, startRun(user, RUNNER), 40).andExpect(status().isOk());

        String anonymous = mockMvc.perform(get("/api/v1/games/highlights")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug=='runner')].topScore").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        java.util.List<Object> anonymousBest = JsonPath.read(anonymous, "$.data[?(@.slug=='runner')].myBest");
        assertThat(anonymousBest).containsOnlyNulls();

        String body = send(user, get("/api/v1/games/highlights")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        java.util.List<Integer> mine = JsonPath.read(body, "$.data[?(@.slug=='runner')].myBest");
        java.util.List<Integer> rank = JsonPath.read(body, "$.data[?(@.slug=='runner')].myRank");
        assertThat(mine).containsExactly(40);
        assertThat(rank.get(0)).isGreaterThanOrEqualTo(1);
        // 닫힌 게임이 아니라 열린 게임 정보만, 이메일 같은 계정 정보는 없다
        assertThat(body).doesNotContain(user.email());
    }

    @Test
    @DisplayName("2048 은 열려 있고, 시간 안의 점수는 기록되며 이론상 최대 점수를 넘는 값은 거절한다")
    void game2048() throws Exception {
        mockMvc.perform(get("/api/v1/games/2048")).andExpect(status().isOk());
        TestUser user = newUser();

        String ok = startRun(user, "2048");
        send(user, post("/api/v1/games/{s}/runs/{r}/score", "2048", ok).contentType(MediaType.APPLICATION_JSON).content("{\"score\":1500}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.best").value(1500));

        String tooBig = startRun(user, "2048");
        send(user, post("/api/v1/games/{s}/runs/{r}/score", "2048", tooBig).contentType(MediaType.APPLICATION_JSON).content("{\"score\":3932157}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("SCORE-400-01"));
    }

    @Test
    @DisplayName("귤 폭격 도로롱은 열려 있고, 판 시간 안에 낼 수 있는 점수만 기록한다")
    void orangeBlitz() throws Exception {
        mockMvc.perform(get("/api/v1/games/orange-blitz")).andExpect(status().isOk());
        TestUser user = newUser();

        String ok = startRun(user, "orange-blitz");
        send(user, post("/api/v1/games/{s}/runs/{r}/score", "orange-blitz", ok).contentType(MediaType.APPLICATION_JSON).content("{\"score\":4200}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.best").value(4200));

        // 판을 시작하자마자 낼 수 없는 값(네트워크 여유를 합쳐도 초당 2500점 한도를 넘는다)은 거절한다
        String tooFast = startRun(user, "orange-blitz");
        send(user, post("/api/v1/games/{s}/runs/{r}/score", "orange-blitz", tooFast).contentType(MediaType.APPLICATION_JSON).content("{\"score\":50000}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("SCORE-400-01"));
    }
}
