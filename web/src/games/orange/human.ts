import { createBot, type BotOptions } from './bot';
import { FIELD, FPS, nextUint, px, type Dumbbell, type Enemy, type Gate, type Item, type OrangeInput, type OrangeState } from './engine';

/**
 * 사람처럼 하는 봇(시험용). 기본 봇은 모든 것을 즉시 보고 정확히 움직이는 "초인" 이라 난이도를 재는 데 부족하다.
 * 여기서는 사람의 한계를 흉내 낸다:
 *  - 반응 지연: 지금 일어난 일이 아니라 `reactionMs` 전 화면을 보고 결정한다(사람의 단순 반응은 대개 200~300ms, 숙련자 150ms 안팎).
 *  - 결정 주기: 매 프레임 바꾸지 않고 몇 프레임에 한 번만 목표를 갱신한다(눈과 손이 짝을 이루는 속도).
 *  - 조작 오차: 목표 지점이 조금씩 어긋난다(손가락 위치·눈대중).
 *  - 집중 저하: 가끔 0.3~0.7초 동안 반응하지 못하고 마지막 입력을 그대로 둔다.
 *  - 시야: 멀리 있는 위험은 보지 못한다.
 */
export interface HumanProfile {
  /** 반응 시간(ms)의 범위. 결정마다 이 안에서 고른다 */
  reactionMs: readonly [number, number];
  /** 목표를 갱신하는 주기(프레임) */
  decisionEvery: number;
  /** 목표가 어긋나는 최대 폭(px) */
  jitter: number;
  /** 집중이 끊기는 평균 간격(프레임). 0 이면 끊기지 않는다 */
  lapseEvery: number;
  /** 집중이 끊긴 길이(프레임) 범위 */
  lapseTicks: readonly [number, number];
  bot: BotOptions;
}

export const HUMANS: Record<'elite' | 'normal' | 'casual', HumanProfile> = {
  /** 게임에 익숙하고 집중한 사람 */
  elite: { reactionMs: [150, 210], decisionEvery: 3, jitter: 3, lapseEvery: 2400, lapseTicks: [12, 22], bot: { greed: 1, lookAhead: 380, gateMistake: 0.05, seed: 3 } },
  /** 보통의 사람 */
  normal: { reactionMs: [200, 280], decisionEvery: 5, jitter: 6, lapseEvery: 1500, lapseTicks: [18, 36], bot: { greed: 1.2, lookAhead: 300, distractionEvery: 400, gateMistake: 0.15, seed: 5 } },
  /** 처음 해보는 사람 */
  casual: { reactionMs: [270, 380], decisionEvery: 8, jitter: 10, lapseEvery: 900, lapseTicks: [24, 48], bot: { greed: 1.4, lookAhead: 220, distractionEvery: 150, gateMistake: 0.3, seed: 11 } },
};

interface Seen {
  enemies: Enemy[];
  dumbbells: Dumbbell[];
  gates: Gate[];
  items: Item[];
}

const snapshot = (state: OrangeState): Seen => ({
  enemies: state.enemies.map((e) => ({ ...e })),
  dumbbells: state.dumbbells.map((d) => ({ ...d })),
  gates: state.gates.map((g) => ({ ...g })),
  items: state.items.map((i) => ({ ...i })),
});

/** 사람처럼 하는 봇을 만든다. 같은 seed 면 같은 행동을 한다. */
export function createHuman(profile: HumanProfile, seed = 1): (state: OrangeState) => OrangeInput {
  let rng = (seed * 2654435761) >>> 0;
  const roll = (n: number): number => {
    const { value, next } = nextUint(rng);
    rng = next;
    return value % n;
  };
  const between = (lo: number, hi: number): number => lo + roll(hi - lo + 1);

  const brain = createBot({ ...profile.bot, seed: (profile.bot.seed ?? 1) + seed });
  const history: Seen[] = [];
  let target = FIELD.width / 2;
  let lapseUntil = -1;
  let lagTicks = Math.round((between(profile.reactionMs[0], profile.reactionMs[1]) * FPS) / 1000);

  return (state) => {
    history.push(snapshot(state));
    if (history.length > 40) {
      history.shift();
    }
    if (profile.lapseEvery > 0 && state.tick >= lapseUntil && roll(profile.lapseEvery) === 0) {
      lapseUntil = state.tick + between(profile.lapseTicks[0], profile.lapseTicks[1]);
    }
    if (state.tick % profile.decisionEvery === 0 && state.tick >= lapseUntil) {
      lagTicks = Math.round((between(profile.reactionMs[0], profile.reactionMs[1]) * FPS) / 1000);
      const seen = history[Math.max(0, history.length - 1 - lagTicks)];
      // 눈에 보이는 것은 lagTicks 전 모습, 내 위치는 지금(내 손은 지금 위치를 안다)
      const view: OrangeState = { ...state, enemies: seen.enemies, dumbbells: seen.dumbbells, gates: seen.gates, items: seen.items };
      const wanted = brain(view).targetX;
      target = Math.min(FIELD.width, Math.max(0, wanted + (roll(2 * profile.jitter + 1) - profile.jitter) * px(1)));
    }
    return { targetX: target };
  };
}
