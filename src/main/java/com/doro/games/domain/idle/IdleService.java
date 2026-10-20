package com.doro.games.domain.idle;

import com.doro.games.common.exception.ErrorCode;
import com.doro.games.common.exception.GamesException;
import com.doro.games.domain.idle.IdleDtos.IdleView;
import com.doro.games.domain.idle.IdleDtos.ProducerView;
import com.doro.games.domain.user.service.GameUserService;
import com.hunnit_beasts.doro.sdk.domain.DoroUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * 도로롱 귤농장. 진행은 모두 서버가 계산한다: 생산은 서버 시계로 정산하고, 탭은 사람이 누를 수 있는 속도까지만 인정하고,
 * 구매는 서버가 가진 귤로만 한다. 사용자마다 한 줄을 잠그고(FOR UPDATE) 처리해서 동시에 여러 요청이 와도 값이 어긋나지 않는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IdleService {

    private final JdbcClient jdbc;
    private final GameUserService userService;
    private final Clock clock;

    /** 한 줄(잠금) */
    private static final class Save {
        long oranges;
        long totalEarned;
        int tapLevel;
        int[] levels;
        Instant settledAt;
        long tapBudgetMilli;
        Instant tapBudgetAt;
    }

    /** 이번 요청에서 정산된 값(응답에 알려 준다) */
    private record Settlement(long seconds, long gained, boolean capped) {}

    @Transactional
    public IdleView view(DoroUser doroUser) {
        UUID userId = userService.getOrCreateUser(doroUser).getId();
        Save save = lock(userId);
        Settlement settlement = settle(save, clock.instant());
        persist(userId, save);
        return toView(save, settlement);
    }

    /** 귤 따기: 서버가 잰 시간 동안 사람이 누를 수 있는 횟수(초당 15, 한꺼번에 최대 100)까지만 인정한다. 넘친 횟수는 조용히 버린다. */
    @Transactional
    public IdleView tap(DoroUser doroUser, int count) {
        UUID userId = userService.getOrCreateUser(doroUser).getId();
        Save save = lock(userId);
        Instant now = clock.instant();
        Settlement settlement = settle(save, now);

        long elapsedMs = Math.max(0, now.toEpochMilli() - save.tapBudgetAt.toEpochMilli());
        long budget = Math.min(IdleRules.TAP_BURST_MILLI, save.tapBudgetMilli + elapsedMs * IdleRules.TAP_PER_SECOND);
        long allowed = Math.min(count, budget / 1000);
        save.tapBudgetMilli = budget - allowed * 1000;
        save.tapBudgetAt = now;
        if (allowed > 0) {
            long power = IdleRules.tapPower(save.tapLevel, IdleRules.ratePerSecond(save.levels));
            earn(save, power * allowed);
        }
        persist(userId, save);
        return toView(save, settlement);
    }

    @Transactional
    public IdleView buyProducer(DoroUser doroUser, int index, int amount) {
        if (index < 0 || index >= IdleRules.PRODUCER_COUNT || !IdleRules.BUY_AMOUNTS.contains(amount)) {
            throw new GamesException(ErrorCode.INVALID_INPUT);
        }
        UUID userId = userService.getOrCreateUser(doroUser).getId();
        Save save = lock(userId);
        Settlement settlement = settle(save, clock.instant());
        var plan = IdleRules.planProducer(index, save.levels[index], amount, save.oranges);
        if (plan.count() == 0) {
            persist(userId, save);
            throw new GamesException(ErrorCode.IDLE_CANNOT_AFFORD);
        }
        save.oranges -= plan.cost();
        save.levels[index] += plan.count();
        persist(userId, save);
        return toView(save, settlement);
    }

    @Transactional
    public IdleView buyTapUpgrade(DoroUser doroUser, int amount) {
        if (!IdleRules.BUY_AMOUNTS.contains(amount)) {
            throw new GamesException(ErrorCode.INVALID_INPUT);
        }
        UUID userId = userService.getOrCreateUser(doroUser).getId();
        Save save = lock(userId);
        Settlement settlement = settle(save, clock.instant());
        var plan = IdleRules.planTap(save.tapLevel, amount, save.oranges);
        if (plan.count() == 0) {
            persist(userId, save);
            throw new GamesException(ErrorCode.IDLE_CANNOT_AFFORD);
        }
        save.oranges -= plan.cost();
        save.tapLevel += plan.count();
        persist(userId, save);
        return toView(save, settlement);
    }

    // ------------------------------------------------------------------------------------------ 내부

    private Save lock(UUID userId) {
        Instant now = clock.instant();
        jdbc.sql("""
                INSERT INTO idle_saves (user_id, levels, settled_at, tap_budget_milli, tap_budget_at)
                VALUES (:userId, :levels, :now, :budget, :now)
                ON CONFLICT (user_id) DO NOTHING
                """)
                .param("userId", userId)
                .param("levels", "0,".repeat(IdleRules.PRODUCER_COUNT - 1) + "0")
                .param("now", Timestamp.from(now))
                .param("budget", IdleRules.TAP_BURST_MILLI)
                .update();
        return jdbc.sql("""
                SELECT oranges, total_earned, tap_level, levels, settled_at, tap_budget_milli, tap_budget_at
                FROM idle_saves WHERE user_id = :userId FOR UPDATE
                """)
                .param("userId", userId)
                .query((rs, i) -> {
                    Save s = new Save();
                    s.oranges = rs.getLong("oranges");
                    s.totalEarned = rs.getLong("total_earned");
                    s.tapLevel = rs.getInt("tap_level");
                    s.levels = parseLevels(rs.getString("levels"));
                    s.settledAt = rs.getTimestamp("settled_at").toInstant();
                    s.tapBudgetMilli = rs.getLong("tap_budget_milli");
                    s.tapBudgetAt = rs.getTimestamp("tap_budget_at").toInstant();
                    return s;
                })
                .single();
    }

    private void persist(UUID userId, Save s) {
        jdbc.sql("""
                UPDATE idle_saves SET oranges = :oranges, total_earned = :total, tap_level = :tap, levels = :levels,
                       settled_at = :settled, tap_budget_milli = :budget, tap_budget_at = :budgetAt
                WHERE user_id = :userId
                """)
                .param("oranges", s.oranges).param("total", s.totalEarned).param("tap", s.tapLevel)
                .param("levels", joinLevels(s.levels))
                .param("settled", Timestamp.from(s.settledAt))
                .param("budget", s.tapBudgetMilli).param("budgetAt", Timestamp.from(s.tapBudgetAt))
                .param("userId", userId)
                .update();
    }

    /** 마지막 정산 이후의 시간을 귤로 바꾼다. 시계가 거꾸로 가도(시간 차이가 음수) 아무것도 하지 않는다. */
    private Settlement settle(Save s, Instant now) {
        long elapsedMs = now.toEpochMilli() - s.settledAt.toEpochMilli();
        if (elapsedMs <= 0) {
            return new Settlement(0, 0, false);
        }
        long rate = IdleRules.ratePerSecond(s.levels);
        var gain = IdleRules.settle(rate, elapsedMs);
        long before = s.oranges;
        earn(s, gain.oranges());
        s.settledAt = s.settledAt.plusMillis(gain.consumedMs());
        long seconds = Math.min(elapsedMs, IdleRules.OFFLINE_CAP_MS) / 1000;
        // 정산이 의미 있는 시간(1분 이상)만 "자리 비운 동안" 으로 알린다
        return new Settlement(seconds >= 60 ? seconds : 0, s.oranges - before, elapsedMs > IdleRules.OFFLINE_CAP_MS);
    }

    private static void earn(Save s, long gain) {
        long before = s.oranges;
        s.oranges = IdleRules.addCapped(s.oranges, gain);
        s.totalEarned = Math.min(IdleRules.ORANGE_CAP, s.totalEarned + (s.oranges - before));
    }

    private IdleView toView(Save s, Settlement settlement) {
        long rate = IdleRules.ratePerSecond(s.levels);
        int multiplier = IdleRules.multiplierPercent(s.levels);
        int collected = IdleRules.collected(s.levels);
        int bonus = IdleRules.collectionBonusPercent(collected);
        List<ProducerView> producers = new ArrayList<>();
        for (int i = 0; i < IdleRules.PRODUCER_COUNT; i++) {
            var p = IdleRules.PRODUCERS.get(i);
            long contribution = IdleRules.producerOutput(i, s.levels[i]) * multiplier * bonus / 10_000;
            // 처음 만날 때까지는 가려 둔다: 다음 도로롱은 값의 절반을 모으면 보인다
            boolean revealed = i == 0 || s.levels[i] > 0 || s.totalEarned * 2 >= p.baseCost();
            producers.add(new ProducerView(i, p.name(), s.levels[i], IdleRules.producerCost(i, s.levels[i]), p.baseRate(), contribution, revealed,
                    IdleRules.milestonesReached(s.levels[i]), IdleRules.outputMultiplier(s.levels[i]), IdleRules.nextMilestone(s.levels[i])));
        }
        int nextTarget = 0;
        int nextPercent = 0;
        for (int t = 0; t < IdleRules.COLLECTION_TARGETS.length; t++) {
            if (collected < IdleRules.COLLECTION_TARGETS[t]) {
                nextTarget = IdleRules.COLLECTION_TARGETS[t];
                nextPercent = IdleRules.COLLECTION_TARGET_PERCENT[t];
                break;
            }
        }
        return new IdleView(s.oranges, s.totalEarned, rate, multiplier, s.tapLevel, IdleRules.tapPower(s.tapLevel, rate),
                IdleRules.tapUpgradeCost(s.tapLevel), collected, IdleRules.PRODUCER_COUNT, bonus, nextTarget, nextPercent, producers,
                clock.millis(), settlement.seconds(), settlement.gained(), settlement.capped(), IdleRules.ORANGE_CAP);
    }

    static int[] parseLevels(String text) {
        int[] levels = new int[IdleRules.PRODUCER_COUNT];
        String[] parts = text.split(",");
        for (int i = 0; i < levels.length && i < parts.length; i++) {
            levels[i] = Math.max(0, Math.min(IdleRules.MAX_LEVEL, Integer.parseInt(parts[i].trim())));
        }
        return levels;
    }

    static String joinLevels(int[] levels) {
        return String.join(",", Arrays.stream(levels).mapToObj(Integer::toString).toList());
    }
}
