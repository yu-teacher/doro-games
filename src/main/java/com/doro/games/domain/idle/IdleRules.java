package com.doro.games.domain.idle;

import java.math.BigInteger;
import java.util.List;
import java.util.function.IntToLongFunction;

/**
 * 도로롱 귤농장의 규칙(순수 계산). 저장·시계·HTTP 와 상관없어서 DB 없이 시험한다.
 * 모든 수는 long 정수이고, 곱셈 중간값이 넘치지 않게 나눗셈을 먼저 한다. 귤은 JS 가 정확히 다루는 정수(2^53) 안에서 멈춘다.
 */
public final class IdleRules {

    /** 귤 창고 한도. 클라이언트(JS)가 정확히 표시할 수 있는 정수 범위 안이다. */
    public static final long ORANGE_CAP = 9_000_000_000_000_000L;
    /** 자리를 비워도 이만큼까지만 정산한다. */
    public static final long OFFLINE_CAP_MS = 8L * 60 * 60 * 1000;
    /** 한 종류 도로롱의 최대 레벨 */
    public static final int MAX_LEVEL = 500;
    /** 도감에 올린 도로롱 종류 하나마다 생산량이 늘어나는 비율(%) */
    public static final int COLLECTION_BONUS_PERCENT = 4;
    /**
     * 마일스톤: 한 종류의 레벨이 이 값에 닿을 때마다 그 도로롱의 생산이 두 배가 된다(숫자가 확 튀는 순간).
     * 마지막(400) 뒤에는 없다. 최대 레벨(500)에서 ×128.
     */
    public static final int[] MILESTONE_LEVELS = {10, 25, 50, 100, 200, 300, 400};
    /** 도감 완성도 보너스: 종류 수가 이 값에 닿으면 전체 생산에 곱해지는 배율(%). 누적이 아니라 가장 높은 것 하나만 적용한다. */
    public static final int[] COLLECTION_TARGETS = {4, 8, 12};
    public static final int[] COLLECTION_TARGET_PERCENT = {125, 150, 200};
    /** 값이 이보다 커지면 더 키우지 않는다(비용이 넘치지 않게). 귤 한도보다 훨씬 커서 사실상 살 수 없다. */
    private static final long COST_SATURATION = 4_000_000_000_000_000_000L;

    /** 탭: 초당 이 횟수까지, 한꺼번에 최대 BURST 번까지 인정한다(사람이 누를 수 있는 속도). */
    public static final int TAP_PER_SECOND = 15;
    public static final int TAP_BURST = 100;
    public static final long TAP_BURST_MILLI = TAP_BURST * 1000L;

    /** 구매 단위 */
    public static final List<Integer> BUY_AMOUNTS = List.of(1, 10, 100);

    public record Producer(String name, long baseCost, long baseRate) {}

    /**
     * 도로롱 종류(의상). 순서대로 비싸고 강해진다. baseRate 는 레벨 1 하나가 초당 만드는 귤.
     * 비용은 레벨마다 15% 씩 오른다.
     */
    public static final List<Producer> PRODUCERS = List.of(
            new Producer("아기 도로롱", 15, 1),
            new Producer("치킨 도로롱", 100, 5),
            new Producer("토끼 도로롱", 1_100, 30),
            new Producer("펭귄 도로롱", 12_000, 170),
            new Producer("공룡 도로롱", 130_000, 950),
            new Producer("상어 도로롱", 1_400_000, 5_500),
            new Producer("수박 도로롱", 20_000_000, 32_000),
            new Producer("카우보이 도로롱", 330_000_000, 190_000),
            new Producer("메이드 도로롱", 5_100_000_000L, 1_150_000),
            new Producer("근육 도로롱", 75_000_000_000L, 7_000_000),
            new Producer("폐하 도로롱", 1_000_000_000_000L, 42_000_000),
            new Producer("은박지 도로롱", 14_000_000_000_000L, 260_000_000));

    public static final int PRODUCER_COUNT = PRODUCERS.size();

    private static final long TAP_UPGRADE_BASE_COST = 100;
    private static final int TAP_GROWTH_PERCENT = 140;
    private static final int PRODUCER_GROWTH_PERCENT = 115;

    private static final long[][] PRODUCER_COSTS = new long[PRODUCER_COUNT][];
    private static final long[] TAP_COSTS;

    static {
        for (int i = 0; i < PRODUCER_COUNT; i++) {
            PRODUCER_COSTS[i] = costTable(PRODUCERS.get(i).baseCost(), PRODUCER_GROWTH_PERCENT, MAX_LEVEL + 1);
        }
        TAP_COSTS = costTable(TAP_UPGRADE_BASE_COST, TAP_GROWTH_PERCENT, MAX_LEVEL + 1);
    }

    private IdleRules() {}

    /** 레벨 n 에서 n+1 로 올릴 때 드는 비용 표(0번이 첫 구매). 비용은 한도에서 멈춘다. */
    private static long[] costTable(long base, int growthPercent, int size) {
        long[] table = new long[size];
        long cost = base;
        for (int i = 0; i < size; i++) {
            table[i] = cost;
            // cost × percent / 100 을 넘치지 않게: 몫과 나머지를 따로 곱한다
            long next = (cost / 100) * growthPercent + ((cost % 100) * growthPercent) / 100;
            cost = Math.min(COST_SATURATION, Math.max(next, cost + 1));
        }
        return table;
    }

    /** 도로롱 종류 i 를 지금 레벨에서 한 단계 올리는 비용(최대 레벨이면 한도 값) */
    public static long producerCost(int index, int level) {
        return PRODUCER_COSTS[index][Math.min(level, MAX_LEVEL)];
    }

    public static long tapUpgradeCost(int level) {
        return TAP_COSTS[Math.min(level, MAX_LEVEL)];
    }

    /** 탭 한 번에 얻는 귤. 레벨 0 은 1, 레벨마다 1 씩 늘고, 생산량의 일부도 더해진다(자라난 농장일수록 탭도 의미가 있게). */
    public static long tapPower(int tapLevel, long ratePerSecond) {
        return 1 + tapLevel + ratePerSecond / 100;
    }

    /** 이 레벨까지 닿은 마일스톤 수 */
    public static int milestonesReached(int level) {
        int reached = 0;
        for (int m : MILESTONE_LEVELS) {
            if (level >= m) {
                reached++;
            }
        }
        return reached;
    }

    /** 다음 마일스톤 레벨(모두 닿았으면 0) */
    public static int nextMilestone(int level) {
        for (int m : MILESTONE_LEVELS) {
            if (level < m) {
                return m;
            }
        }
        return 0;
    }

    /** 이 레벨에서 그 도로롱의 생산 배수(마일스톤마다 ×2) */
    public static long outputMultiplier(int level) {
        return 1L << milestonesReached(level);
    }

    /** 도감 완성도 보너스 배율(%): 100(없음), 125, 150, 200 */
    public static int collectionBonusPercent(int collected) {
        int percent = 100;
        for (int i = 0; i < COLLECTION_TARGETS.length; i++) {
            if (collected >= COLLECTION_TARGETS[i]) {
                percent = COLLECTION_TARGET_PERCENT[i];
            }
        }
        return percent;
    }

    /** 레벨이 1 이상인 도로롱 종류 수(도감) */
    public static int collected(int[] levels) {
        int count = 0;
        for (int level : levels) {
            if (level > 0) {
                count++;
            }
        }
        return count;
    }

    /** 도감 보너스를 포함한 생산량의 배율(%) */
    public static int multiplierPercent(int[] levels) {
        return 100 + COLLECTION_BONUS_PERCENT * collected(levels);
    }

    /** 도로롱 종류 하나의 기본 생산(마일스톤 반영, 도감 배율 전) */
    public static long producerOutput(int index, int level) {
        return (long) level * PRODUCERS.get(index).baseRate() * outputMultiplier(level);
    }

    /**
     * 초당 귤 생산량(정수, 내림): 종류별 생산(마일스톤 반영)의 합 × 도감 종류 보너스(4%/종) × 도감 완성도 보너스.
     * 최대 레벨 500 이 모두 ×128 일 때도 합이 2×10^13 안팎이라 곱셈 중간값이 long 안에 든다(테스트로 확인).
     */
    public static long ratePerSecond(int[] levels) {
        long sum = 0;
        for (int i = 0; i < PRODUCER_COUNT; i++) {
            sum += producerOutput(i, levels[i]);
        }
        return sum * multiplierPercent(levels) * collectionBonusPercent(collected(levels)) / 10_000;
    }

    /** 이 정산에서 얻는 귤과, 소비한 시간(ms). 남은 시간은 다음 정산으로 넘어간다. */
    public record Gain(long oranges, long consumedMs) {}

    /**
     * rate(초당)로 elapsedMs 동안 얻는 귤. 정수만 얻고, 아직 한 개가 안 되는 시간은 소비하지 않는다(자주 불러도 손해가 없다).
     * 자리를 오래 비운 시간은 OFFLINE_CAP_MS 까지만 인정하고 나머지는 버린다(consumedMs 가 elapsedMs 와 같아진다).
     */
    public static Gain settle(long rate, long elapsedMs) {
        if (rate <= 0 || elapsedMs <= 0) {
            return new Gain(0, Math.max(0, elapsedMs));
        }
        long usable = Math.min(elapsedMs, OFFLINE_CAP_MS);
        boolean forfeits = elapsedMs > OFFLINE_CAP_MS;
        // rate × ms 는 마일스톤이 쌓이면 long 을 넘을 수 있어서 BigInteger 로 계산한다(정산마다 한 번이라 비용이 거의 없다)
        BigInteger raw = BigInteger.valueOf(rate).multiply(BigInteger.valueOf(usable)).divide(BigInteger.valueOf(1000));
        BigInteger cap = BigInteger.valueOf(ORANGE_CAP);
        if (raw.signum() == 0) {
            return new Gain(0, forfeits ? elapsedMs : 0);
        }
        boolean capped = raw.compareTo(cap) > 0;
        long oranges = capped ? ORANGE_CAP : raw.longValueExact();
        // 한도에 걸렸거나 8시간을 넘긴 시간은 통째로 소비한다. 그 밖에는 얻은 귤만큼의 시간만 소비하고 나머지는 다음으로 넘긴다.
        long consumed = (capped || forfeits)
                ? elapsedMs
                : Math.min(usable, BigInteger.valueOf(oranges).multiply(BigInteger.valueOf(1000)).divide(BigInteger.valueOf(rate)).longValueExact());
        return new Gain(oranges, consumed);
    }

    /** 귤 한도를 넘지 않게 더한다. 실제로 더해진 양을 돌려주려면 호출한 쪽이 차이를 계산한다. */
    public static long addCapped(long oranges, long gain) {
        return Math.min(ORANGE_CAP, oranges + Math.min(gain, ORANGE_CAP));
    }

    /** 도로롱 종류 index 를 amount 번까지 살 때 가능한 횟수와 총비용 */
    public record Purchase(int count, long cost) {}

    public static Purchase planProducer(int index, int level, int amount, long oranges) {
        return plan(level, amount, oranges, MAX_LEVEL, l -> producerCost(index, l));
    }

    public static Purchase planTap(int level, int amount, long oranges) {
        return plan(level, amount, oranges, MAX_LEVEL, IdleRules::tapUpgradeCost);
    }

    /** 레벨 level 에서 시작해 최대 amount 번, 최대 레벨과 가진 귤 안에서 살 수 있는 만큼 */
    private static Purchase plan(int level, int amount, long oranges, int maxLevel, IntToLongFunction costAt) {
        int count = 0;
        long total = 0;
        while (count < amount && level + count < maxLevel) {
            long next = costAt.applyAsLong(level + count);
            if (total > oranges - next) {
                break;
            }
            total += next;
            count++;
        }
        return new Purchase(count, total);
    }
}
