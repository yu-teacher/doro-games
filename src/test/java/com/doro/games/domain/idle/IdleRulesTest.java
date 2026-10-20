package com.doro.games.domain.idle;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 귤농장 규칙(순수 계산). DB 없이 돈다. */
class IdleRulesTest {

    private static int[] levels(int... values) {
        int[] all = new int[IdleRules.PRODUCER_COUNT];
        System.arraycopy(values, 0, all, 0, values.length);
        return all;
    }

    @Test
    @DisplayName("도로롱은 12종이고 순서대로 비싸고 강해진다")
    void producersGetPricierAndStronger() {
        assertThat(IdleRules.PRODUCER_COUNT).isEqualTo(12);
        for (int i = 1; i < IdleRules.PRODUCER_COUNT; i++) {
            assertThat(IdleRules.PRODUCERS.get(i).baseCost()).isGreaterThan(IdleRules.PRODUCERS.get(i - 1).baseCost());
            assertThat(IdleRules.PRODUCERS.get(i).baseRate()).isGreaterThan(IdleRules.PRODUCERS.get(i - 1).baseRate());
        }
    }

    @Test
    @DisplayName("비용은 레벨마다 오르고 끝없이 커져도 넘치지 않는다")
    void costsGrowWithoutOverflow() {
        for (int i = 0; i < IdleRules.PRODUCER_COUNT; i++) {
            long previous = 0;
            for (int level = 0; level <= IdleRules.MAX_LEVEL + 5; level++) {
                long cost = IdleRules.producerCost(i, level);
                assertThat(cost).isPositive().isGreaterThanOrEqualTo(previous);
                previous = cost;
            }
        }
        long previous = 0;
        for (int level = 0; level <= IdleRules.MAX_LEVEL; level++) {
            long cost = IdleRules.tapUpgradeCost(level);
            assertThat(cost).isPositive().isGreaterThanOrEqualTo(previous);
            previous = cost;
        }
        assertThat(IdleRules.producerCost(0, 0)).isEqualTo(15);
        assertThat(IdleRules.producerCost(0, 1)).isEqualTo(17); // 15 × 115% = 17.25
    }

    @Test
    @DisplayName("생산량은 도감에 오른 종류마다 4% 씩 늘어난다")
    void collectionBonus() {
        assertThat(IdleRules.ratePerSecond(levels())).isZero();
        assertThat(IdleRules.ratePerSecond(levels(10))).isEqualTo(10 * 1 * 104 / 100);
        assertThat(IdleRules.collected(levels(1, 0, 3))).isEqualTo(2);
        assertThat(IdleRules.multiplierPercent(levels(1, 1, 1))).isEqualTo(112);
    }

    @Test
    @DisplayName("레벨과 시간의 한계에서도 생산·정산 계산이 넘치지 않는다")
    void noOverflowAtTheLimits() {
        int[] maxed = new int[IdleRules.PRODUCER_COUNT];
        java.util.Arrays.fill(maxed, IdleRules.MAX_LEVEL);
        long rate = IdleRules.ratePerSecond(maxed);
        assertThat(rate).isPositive();
        var gain = IdleRules.settle(rate, IdleRules.OFFLINE_CAP_MS);
        assertThat(gain.oranges()).isPositive();
        assertThat(rate * IdleRules.OFFLINE_CAP_MS / 1000).isEqualTo(gain.oranges());
        // 한도 안의 정수이므로 더해도 한도를 넘지 않는다
        assertThat(IdleRules.addCapped(IdleRules.ORANGE_CAP - 1, gain.oranges())).isEqualTo(IdleRules.ORANGE_CAP);
        assertThat(IdleRules.addCapped(0, Long.MAX_VALUE)).isEqualTo(IdleRules.ORANGE_CAP);
    }

    @Test
    @DisplayName("정산: 한 개가 안 되는 시간은 소비하지 않아서 자주 불러도 손해가 없다")
    void settlementKeepsTheRemainder() {
        // 초당 1개: 300ms 는 아직 한 개가 아니다
        var none = IdleRules.settle(1, 300);
        assertThat(none.oranges()).isZero();
        assertThat(none.consumedMs()).isZero();
        // 1500ms → 1개, 1000ms 소비, 500ms 는 다음으로
        var one = IdleRules.settle(1, 1500);
        assertThat(one.oranges()).isEqualTo(1);
        assertThat(one.consumedMs()).isEqualTo(1000);
        // 초당 7개, 1000ms → 7개
        assertThat(IdleRules.settle(7, 1000).oranges()).isEqualTo(7);
    }

    @Test
    @DisplayName("정산: 자리를 8시간보다 오래 비워도 8시간치만 받고 나머지 시간은 버린다")
    void offlineCap() {
        long tenHours = 10L * 60 * 60 * 1000;
        var gain = IdleRules.settle(2, tenHours);
        assertThat(gain.oranges()).isEqualTo(2 * 8 * 3600);
        assertThat(gain.consumedMs()).isEqualTo(tenHours);
    }

    @Test
    @DisplayName("정산: 생산이 없거나 시간이 없으면 귤은 없다")
    void nothingToSettle() {
        assertThat(IdleRules.settle(0, 5000).oranges()).isZero();
        assertThat(IdleRules.settle(5, 0).oranges()).isZero();
        assertThat(IdleRules.settle(5, -100).oranges()).isZero();
    }

    @Test
    @DisplayName("구매 계획: 가진 귤로 살 수 있는 만큼만, 최대 레벨 안에서")
    void purchasePlan() {
        // 아기 도로롱 15, 17, 19(≈19.55), 22(≈22.4) …
        var one = IdleRules.planProducer(0, 0, 1, 15);
        assertThat(one.count()).isEqualTo(1);
        assertThat(one.cost()).isEqualTo(15);
        assertThat(IdleRules.planProducer(0, 0, 1, 14).count()).isZero();
        var ten = IdleRules.planProducer(0, 0, 10, 1_000_000);
        assertThat(ten.count()).isEqualTo(10);
        long sum = 0;
        for (int l = 0; l < 10; l++) {
            sum += IdleRules.producerCost(0, l);
        }
        assertThat(ten.cost()).isEqualTo(sum);
        // 100 번 사려 해도 귤이 모자라면 되는 만큼만
        var partial = IdleRules.planProducer(0, 0, 100, 100);
        assertThat(partial.count()).isBetween(1, 99);
        assertThat(partial.cost()).isLessThanOrEqualTo(100);
        // 최대 레벨에서는 더 못 산다
        assertThat(IdleRules.planProducer(0, IdleRules.MAX_LEVEL, 1, Long.MAX_VALUE / 2).count()).isZero();
    }

    @Test
    @DisplayName("탭 힘은 장갑 레벨과 생산량에 따라 늘어난다")
    void tapPower() {
        assertThat(IdleRules.tapPower(0, 0)).isEqualTo(1);
        assertThat(IdleRules.tapPower(4, 0)).isEqualTo(5);
        assertThat(IdleRules.tapPower(0, 1_000)).isEqualTo(11);
    }
}
