import { FIELD, FPS, PLAYER, firepower, nextUint, px, runSpeedFor, type Enemy, type GateEffect, type OrangeInput, type OrangeState } from './engine';

/**
 * 규칙 점검용 봇(화면에는 쓰이지 않는다). 게이트의 이로운 쪽을 고르고, 다가오는 귤 덩어리·무리·덤벨을 피하고, 아이템을 줍고,
 * 가까운 적 쪽을 향한다. 균형(어느 스테이지까지 가는가, 점수가 시간당 얼마까지 나는가)을 재고 서버의 점수 규칙을 정할 때 쓴다.
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
  /** 아이템을 줍지 않는다 */
  ignoreItems?: boolean;
  seed?: number;
}

/** 서툰 사람에 가까운 설정: 늦게 보고, 가끔 딴짓하고, 게이트를 가끔 잘못 고르고, 아이템을 놓친다. */
export const CASUAL: BotOptions = { greed: 1.4, lookAhead: 200, distractionEvery: 150, gateMistake: 0.3, ignoreItems: false, seed: 11 };

function gateValue(effect: GateEffect, shots: number): number {
  switch (effect.kind) {
    case 'shotsMul':
      return shots * (effect.value - 1) * 3;
    case 'shotsUp':
      return effect.value * 3;
    case 'dmgUp':
      return effect.value * 2;
    case 'rateUp':
      return effect.value * 2;
    case 'shotsDown':
      return -effect.value * 3;
    case 'shotsHalf':
      return -shots * 2;
  }
}

/** 접근하는 동안 지금 화력으로 부술 수 있는 적인가(화면의 체력 숫자와 내 화력을 견주는 사람의 판단). */
function killable(state: OrangeState, enemy: Enemy): boolean {
  const closing = runSpeedFor(state.stage) + enemy.speed;
  const ticks = Math.max(1, Math.floor(enemy.z / closing));
  return enemy.hp <= (firepower(state.player) * ticks * 0.55) / FPS;
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
    const lookAhead = px(options.lookAhead ?? 420);
    const player = state.player;
    let desired = player.x;

    // 총알이 게이트를 통과하므로 게이트는 가까워졌을 때부터 신경 쓴다. 그 전에는 적을 향해 쏜다.
    const gate = state.gates.find((g) => !g.used && g.z > 0 && g.z < px(280));
    const item = options.ignoreItems ? undefined : state.items.find((it) => it.z > 0 && it.z < px(240));
    // 조준: 무리가 있으면 무리 쪽으로, 아니면 부술 수 있는 가장 가까운 적. 못 부수는 건 조준하지 않고 피한다.
    const crowd = state.enemies.filter((e) => e.kind === 'grunt' && e.z > 0 && e.z < px(600));
    const aimAt = crowd.length > 0
      ? { x: Math.round(crowd.reduce((sum, e) => sum + e.x, 0) / crowd.length) }
      : [...state.enemies].filter((e) => e.z > 0 && killable(state, e)).sort((a, b) => a.z - b.z)[0];
    if (gate) {
      if (gateChoice?.gateId !== gate.id) {
        const better = gateValue(gate.left, player.shots) >= gateValue(gate.right, player.shots);
        const mistaken = options.gateMistake !== undefined && roll(1000) < options.gateMistake * 1000;
        gateChoice = { gateId: gate.id, left: mistaken ? !better : better };
      }
      desired = gateChoice.left ? FIELD.width / 4 : (FIELD.width * 3) / 4;
    } else if (item) {
      desired = item.x;
    } else if (aimAt) {
      desired = aimAt.x;
    }
    if (options.distractionEvery && state.tick >= distractedUntil && roll(options.distractionEvery) === 0) {
      distractedUntil = state.tick + 45;
      distractedTo = px(30) + roll(FIELD.width - px(60));
    }
    if (state.tick < distractedUntil) {
      desired = distractedTo;
    }

    const threats = [
      ...state.enemies.map((e) => ({ x: e.x, z: e.z, half: e.w / 2, depth: e.depth / 2 })),
      ...state.dumbbells.map((d) => ({ x: d.x, z: d.z, half: px(14), depth: px(10) })),
    ].filter((t) => t.z - t.depth < lookAhead && t.z + t.depth > -px(10));
    // 지금 닿을 듯한 것들(깊이가 곧 겹치는 것)이 막고 있는 가로 구간. 그 구간을 가로질러 가면 부딪히므로,
    // 도로롱이 지금 서 있는 빈 구간 안에서만 움직인다(이미 막힌 구간 안이면 어디든 허용: 비상).
    const margin = PLAYER.hitWidth / 2 + px(6);
    let lo = PLAYER.width / 2;
    let hi = FIELD.width - PLAYER.width / 2;
    for (const t of threats) {
      if (t.z - t.depth > px(150)) {
        continue;
      }
      const from = t.x - t.half - margin;
      const to = t.x + t.half + margin;
      if (to <= player.x) {
        lo = Math.max(lo, to);
      } else if (from >= player.x) {
        hi = Math.min(hi, from);
      } else {
        lo = PLAYER.width / 2;
        hi = FIELD.width - PLAYER.width / 2;
        break;
      }
    }
    let best = player.x;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let x = Math.ceil(lo / px(12)) * px(12); x <= hi; x += px(12)) {
      let danger = 0;
      for (const t of threats) {
        const closeness = Math.max(0, 1 - Math.max(0, t.z - t.depth) / lookAhead);
        if (Math.abs(x - t.x) < t.half + PLAYER.hitWidth / 2 + px(8)) {
          danger += 1 + closeness * 8;
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
