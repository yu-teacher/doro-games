import { FIELD, PLAYER, nextUint, px, type GateEffect, type OrangeInput, type OrangeState } from './engine';

/**
 * 규칙 점검용 봇(화면에는 쓰이지 않는다). 게이트의 이로운 쪽을 고르고, 위험한 적·덤벨을 피하고, 귤을 줍고, 가까운 적 밑으로 간다.
 * 균형(어느 웨이브까지 가는가, 점수가 시간당 얼마까지 나는가)을 재고 서버의 점수 규칙을 정할 때 쓴다.
 */
export interface BotOptions {
  /** 값이 클수록 위험 회피보다 목표를 우선한다 */
  greed?: number;
  /** 위험을 보는 거리(px). 짧을수록 늦게 알아챈다 */
  lookAhead?: number;
  /** 한 프레임에 딴짓(엉뚱한 곳으로 움직이기)을 시작할 확률의 분모. 0 이면 딴짓을 하지 않는다 */
  distractionEvery?: number;
  /** 게이트를 잘못 고를 확률(0~1) */
  gateMistake?: number;
  /** 귤·아이템을 줍지 않는다 */
  ignoreItems?: boolean;
  seed?: number;
}

/** 서툰 사람에 가까운 설정: 늦게 보고, 가끔 딴짓하고, 게이트를 가끔 잘못 고르고, 아이템을 놓친다. */
export const CASUAL: BotOptions = { greed: 1.4, lookAhead: 110, distractionEvery: 150, gateMistake: 0.3, ignoreItems: false, seed: 11 };

function gateValue(effect: GateEffect, shots: number): number {
  switch (effect.kind) {
    case 'shotsMul':
      return shots * (effect.value - 1) * 3;
    case 'shotsUp':
      return effect.value * 3;
    case 'dmgUp':
      return effect.value * 4;
    case 'rateUp':
      return effect.value * 2;
    case 'shotsDown':
      return -effect.value * 3;
    case 'shotsHalf':
      return -shots * 2;
  }
}

/** 규칙 점검용 봇을 만든다(호출마다 같은 선택을 하도록 자기 난수를 가진다). */
export function createBot(options: BotOptions = {}): (state: OrangeState) => OrangeInput {
  let rng = (options.seed ?? 1) >>> 0;
  let distractedUntil = 0;
  let distractedTo = FIELD.width / 2;
  let gateChoice: { gateId: number; left: boolean } | null = null;
  const roll = (n: number): number => {
    const { value, next } = nextUint(rng);
    rng = next;
    return value % n;
  };
  return (state) => {
    const greed = options.greed ?? 1;
    const lookAhead = px(options.lookAhead ?? 260);
    const player = state.player;
    let desired = player.x;

    // 총알이 게이트를 통과하므로, 게이트는 거의 도착했을 때(약 2초 앞)부터 신경 쓴다. 그 전에는 적을 잡는다.
    const gate = state.gates.find((g) => !g.used && g.y > PLAYER.y - px(170));
    const item = options.ignoreItems ? undefined : state.items.find((it) => it.y > PLAYER.y - px(200));
    const target = state.enemies.filter((e) => e.y < PLAYER.y - px(10)).sort((a, b) => b.y - a.y)[0];
    if (gate) {
      if (gateChoice?.gateId !== gate.id) {
        const better = gateValue(gate.left, player.shots) >= gateValue(gate.right, player.shots);
        const mistaken = options.gateMistake !== undefined && roll(1000) < options.gateMistake * 1000;
        gateChoice = { gateId: gate.id, left: mistaken ? !better : better };
      }
      desired = gateChoice.left ? FIELD.width / 4 : (FIELD.width * 3) / 4;
    } else if (item) {
      desired = item.x;
    } else if (target) {
      desired = target.x;
    }
    if (options.distractionEvery && state.tick >= distractedUntil && roll(options.distractionEvery) === 0) {
      distractedUntil = state.tick + 45;
      distractedTo = px(30) + roll(FIELD.width - px(60));
    }
    if (state.tick < distractedUntil) {
      desired = distractedTo;
    }

    const threats = [
      ...state.enemies.map((e) => ({ x: e.x, y: e.y, half: e.w / 2 })),
      ...state.enemyShots.map((s) => ({ x: s.x, y: s.y, half: px(14) })),
    ].filter((t) => t.y > PLAYER.y - lookAhead && t.y < PLAYER.y + px(40));
    let best = player.x;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let x = PLAYER.width / 2; x <= FIELD.width - PLAYER.width / 2; x += px(12)) {
      let danger = 0;
      for (const t of threats) {
        const closeness = Math.max(0, 1 - Math.abs(PLAYER.y - t.y) / lookAhead);
        if (Math.abs(x - t.x) < t.half + PLAYER.hitWidth / 2 + px(10)) {
          danger += 1 + closeness * 6;
        }
      }
      const cost = danger * px(220) + Math.abs(x - desired) / greed + Math.abs(x - player.x) / 40;
      if (cost < bestCost) {
        bestCost = cost;
        best = x;
      }
    }
    return { targetX: Math.round(best) };
  };
}

/** 한 번만 쓰는 편의 함수(상태를 기억하지 않는다). */
export function botInput(state: OrangeState, options: BotOptions = {}): OrangeInput {
  return createBot(options)(state);
}
