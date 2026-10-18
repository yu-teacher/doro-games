import { FIELD, PLAYER, px, type GateEffect, type OrangeInput, type OrangeState } from './engine';

/**
 * 규칙 점검용 봇(화면에는 쓰이지 않는다). 게이트의 이로운 쪽을 고르고, 위험한 적·덤벨을 피하고, 귤을 줍고, 가까운 적 밑으로 간다.
 * 균형(어느 웨이브까지 가는가, 점수가 시간당 얼마까지 나는가)을 재고 서버의 점수 규칙을 정할 때 쓴다.
 */
export interface BotOptions {
  /** 값이 클수록 위험 회피보다 목표를 우선한다 */
  greed?: number;
}

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

export function botInput(state: OrangeState, options: BotOptions = {}): OrangeInput {
  const greed = options.greed ?? 1;
  const player = state.player;
  let desired = player.x;

  // 1) 목표: 가까운 게이트의 이로운 쪽 > 귤·아이템 > 가장 가까운 적
  const gate = state.gates.find((g) => !g.used && g.y > PLAYER.y - px(300));
  const item = state.items.find((it) => it.y > PLAYER.y - px(200));
  const target = state.enemies
    .filter((e) => e.y < PLAYER.y - px(10))
    .sort((a, b) => b.y - a.y)[0];
  if (gate) {
    desired = gateValue(gate.left, player.shots) >= gateValue(gate.right, player.shots) ? FIELD.width / 4 : (FIELD.width * 3) / 4;
  } else if (item) {
    desired = item.x;
  } else if (target) {
    desired = target.x;
  }

  // 2) 위험 회피: 후보 x 마다 위에서 내려오는 것들과의 위험도를 매겨 가장 싼 곳을 고른다
  const threats = [
    ...state.enemies.map((e) => ({ x: e.x, y: e.y, half: e.w / 2 })),
    ...state.enemyShots.map((s) => ({ x: s.x, y: s.y, half: px(14) })),
  ].filter((t) => t.y > PLAYER.y - px(260) && t.y < PLAYER.y + px(40));
  let best = player.x;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let x = PLAYER.width / 2; x <= FIELD.width - PLAYER.width / 2; x += px(12)) {
    let danger = 0;
    for (const t of threats) {
      const closeness = Math.max(0, 1 - Math.abs(PLAYER.y - t.y) / px(260));
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
}
