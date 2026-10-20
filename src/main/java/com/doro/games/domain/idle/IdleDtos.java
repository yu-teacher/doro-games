package com.doro.games.domain.idle;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.List;

public final class IdleDtos {

    private IdleDtos() {}

    /** 도로롱 종류 하나의 현재 모습 */
    public record ProducerView(int index, String name, int level, long nextCost, long baseRate, long ratePerSecond, boolean revealed) {}

    /**
     * 농장의 지금 모습. 모든 수는 서버가 계산했다. 화면은 oranges 에 ratePerSecond × (지난 시간)을 더해 부드럽게 보여 주고,
     * 서버 응답이 올 때마다 이 값으로 다시 맞춘다.
     */
    public record IdleView(
            long oranges,
            long totalEarned,
            long ratePerSecond,
            int multiplierPercent,
            int tapLevel,
            long tapPower,
            long tapUpgradeCost,
            int collected,
            int collectionTotal,
            List<ProducerView> producers,
            long serverTimeMillis,
            /** 이번 요청에서 정산된 자리 비운 시간(초)과 그동안 얻은 귤 */
            long offlineSeconds,
            long offlineGained,
            boolean offlineCapped,
            long orangeCap) {}

    public record TapRequest(@Min(1) @Max(IdleRules.TAP_BURST) int count) {}

    public record BuyRequest(@Min(1) @Max(100) int amount) {}
}
