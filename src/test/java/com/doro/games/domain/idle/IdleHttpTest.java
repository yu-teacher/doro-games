package com.doro.games.domain.idle;

import com.doro.games.support.GamesHttpTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 도로롱 귤농장: 서버가 저장·정산·검증한다. 시간은 시험용 시계로 앞으로 돌린다. */
@Import(IdleHttpTest.ClockConfig.class)
class IdleHttpTest extends GamesHttpTestBase {

    /** 시험에서 시간을 앞으로 돌릴 수 있는 시계 */
    static final class MutableClock extends Clock {
        private volatile Instant now = Instant.now();

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @TestConfiguration
    static class ClockConfig {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock();
        }
    }

    @Autowired
    private MutableClock clock;

    private ResultActions tap(TestUser user, int count) throws Exception {
        return send(user, post("/api/v1/idle/tap").contentType(MediaType.APPLICATION_JSON).content("{\"count\":" + count + "}"));
    }

    private ResultActions buy(TestUser user, int index, int amount) throws Exception {
        return send(user, post("/api/v1/idle/producers/{i}/buy", index).contentType(MediaType.APPLICATION_JSON).content("{\"amount\":" + amount + "}"));
    }

    @Test
    @DisplayName("로그인하지 않으면 농장을 볼 수도 만질 수도 없다(401)")
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/v1/idle")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/idle/tap").contentType(MediaType.APPLICATION_JSON).content("{\"count\":1}")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("새 농장은 비어 있고 도로롱 12종과 첫 도로롱만 보인다")
    void newFarm() throws Exception {
        TestUser user = newUser();
        send(user, get("/api/v1/idle")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.oranges").value(0))
                .andExpect(jsonPath("$.data.ratePerSecond").value(0))
                .andExpect(jsonPath("$.data.producers.length()").value(12))
                .andExpect(jsonPath("$.data.producers[0].revealed").value(true))
                .andExpect(jsonPath("$.data.producers[11].revealed").value(false))
                .andExpect(jsonPath("$.data.collected").value(0));
    }

    @Test
    @DisplayName("탭은 사람이 누를 수 있는 속도까지만 인정한다(한꺼번에 100번, 이후엔 시간이 지나야 쌓인다)")
    void tapsAreRateLimited() throws Exception {
        TestUser user = newUser();
        tap(user, 100).andExpect(status().isOk()).andExpect(jsonPath("$.data.oranges").value(100));
        // 예산을 다 썼으니 바로 또 눌러도 늘지 않는다
        tap(user, 100).andExpect(status().isOk()).andExpect(jsonPath("$.data.oranges").value(100));
        // 2초가 지나면 30번(초당 15)까지만 인정한다
        clock.advance(Duration.ofSeconds(2));
        tap(user, 100).andExpect(status().isOk()).andExpect(jsonPath("$.data.oranges").value(130));
        // 잘못된 값
        tap(user, 0).andExpect(status().isBadRequest());
        tap(user, 101).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("귤로 도로롱을 사면 생산이 시작되고, 귤이 모자라면 400이다")
    void buyingProducers() throws Exception {
        TestUser user = newUser();
        buy(user, 0, 1).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("IDLE-400-01"));
        tap(user, 20);
        buy(user, 0, 1).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.oranges").value(5))
                .andExpect(jsonPath("$.data.producers[0].level").value(1))
                .andExpect(jsonPath("$.data.collected").value(1))
                .andExpect(jsonPath("$.data.ratePerSecond").value(1));
        buy(user, 99, 1).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON-400-01"));
        buy(user, 0, 7).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("시간이 지나면 서버가 생산을 정산하고, 자리를 오래 비워도 8시간치만 받는다")
    void offlineProduction() throws Exception {
        TestUser user = newUser();
        tap(user, 40); // 첫 도로롱 15 + 둘째 17
        buy(user, 0, 1).andExpect(status().isOk());
        buy(user, 0, 1).andExpect(status().isOk());
        // 아기 도로롱 2마리: 초당 2 × 104% = 2
        send(user, get("/api/v1/idle")).andExpect(jsonPath("$.data.ratePerSecond").value(2));
        clock.advance(Duration.ofMinutes(10));
        send(user, get("/api/v1/idle")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.offlineSeconds").value(600))
                .andExpect(jsonPath("$.data.offlineGained").value(1200))
                .andExpect(jsonPath("$.data.offlineCapped").value(false));
        // 같은 시각에 다시 불러도 또 정산되지 않는다
        send(user, get("/api/v1/idle")).andExpect(jsonPath("$.data.offlineGained").value(0));

        clock.advance(Duration.ofHours(20));
        send(user, get("/api/v1/idle")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.offlineSeconds").value(8 * 3600))
                .andExpect(jsonPath("$.data.offlineGained").value(2 * 8 * 3600))
                .andExpect(jsonPath("$.data.offlineCapped").value(true));
    }

    @Test
    @DisplayName("사용자마다 농장이 따로이다")
    void farmsAreSeparate() throws Exception {
        TestUser a = newUser();
        TestUser b = newUser();
        tap(a, 50);
        send(b, get("/api/v1/idle")).andExpect(jsonPath("$.data.oranges").value(0));
        send(a, get("/api/v1/idle")).andExpect(jsonPath("$.data.oranges").value(50));
    }

    @Test
    @DisplayName("마일스톤: 도로롱을 키우다 레벨 10 에 닿으면 생산이 두 배가 되고 응답에 반영된다")
    void milestoneDoublesOutput() throws Exception {
        TestUser user = newUser();
        send(user, get("/api/v1/idle")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.producers[0].milestones").value(0))
                .andExpect(jsonPath("$.data.producers[0].nextMilestone").value(10))
                .andExpect(jsonPath("$.data.producers[0].outputMultiplier").value(1))
                .andExpect(jsonPath("$.data.nextCollectionTarget").value(4))
                .andExpect(jsonPath("$.data.collectionBonusPercent").value(100));
        // 귤을 모은다: 탭 100번을 시간을 두고 여러 번(초당 15번 인정) — 아기 도로롱 10레벨까지 약 190 필요
        for (int i = 0; i < 4; i++) {
            tap(user, 100);
            clock.advance(Duration.ofSeconds(8));
        }
        buy(user, 0, 10).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.producers[0].level").value(10))
                .andExpect(jsonPath("$.data.producers[0].milestones").value(1))
                .andExpect(jsonPath("$.data.producers[0].outputMultiplier").value(2))
                .andExpect(jsonPath("$.data.producers[0].nextMilestone").value(25))
                // 10 × 1 × 2 = 20, 도감 1종 +4% → 20
                .andExpect(jsonPath("$.data.ratePerSecond").value(20));
    }
}
