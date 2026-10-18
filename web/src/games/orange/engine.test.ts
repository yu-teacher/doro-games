import { describe, expect, it } from 'vitest';
import {
  FIELD,
  FPS,
  INFINITE_FROM_STAGE,
  LANE_COUNT,
  LANE_WIDTH,
  PLAYER,
  PX,
  STAGE_BOSS_EVERY,
  comboMultiplier,
  createState,
  anchorFirepower,
  baseFirepower,
  challengePercent,
  crowdSpeedBonus,
  damageCap,
  effect,
  firepower,
  firepowerCap,
  gateBounds,
  gateZoneAt,
  infiniteLevel,
  intervalFloor,
  isInfinite,
  nextUint,
  px,
  runSpeedFor,
  SCALING_STAGE_LIMIT,
  shotsCap,
  step,
  type Enemy,
  type EnemyKind,
  type Gate,
  type GateEffect,
  type GateZone,
  type OrangeInput,
  type OrangeState,
} from './engine';

const CENTER = FIELD.width / 2;

function play(state: OrangeState, frames: number, input: (s: OrangeState) => OrangeInput = () => ({ targetX: CENTER })): OrangeState {
  for (let i = 0; i < frames && !state.over; i += 1) {
    step(state, input(state));
  }
  return state;
}

/** 스테이지가 저절로 진행·스폰되지 않는 빈 판(규칙을 하나씩 확인하려고). */
function emptied(seed = 1, stage = 1): OrangeState {
  const state = createState(seed);
  state.stage = stage;
  state.queue = [];
  state.stageStart = Number.MAX_SAFE_INTEGER / 2;
  return state;
}

function enemyAt(state: OrangeState, kind: EnemyKind, x: number, z: number, hp = 1, w = px(30)): Enemy {
  const enemy: Enemy = { id: state.nextId++, kind, x, z, w, depth: px(20), hp, maxHp: hp, speed: 0, flash: 0, shielded: 0, born: state.tick, seed: 0 };
  state.enemies.push(enemy);
  return enemy;
}

/** 가운데에서 둘로 나뉜 게이트(예전 방식). 칸 배열의 0번이 왼쪽, 1번이 오른쪽이다. */
function gateAt(state: OrangeState, z: number, left: GateEffect, right: GateEffect): Gate {
  const gate: Gate = {
    id: state.nextId++,
    z,
    sway: 0,
    used: false,
    zones: [
      { x0: 0, x1: FIELD.width / 2, effect: left, hidden: false },
      { x0: FIELD.width / 2, x1: FIELD.width, effect: right, hidden: false },
    ],
  };
  state.gates.push(gate);
  return gate;
}

/** 다음 스테이지를 계획하게 만들고, 그때 만들어진 스폰 큐를 돌려준다. */
function planStage(seed: number, stage: number, tweak: (s: OrangeState) => void = () => undefined): OrangeState {
  const state = createState(seed);
  // 스테이지 1 은 시작할 때 이미 계획되어 있다(0 은 10 의 배수라 보스 스테이지로 오인되므로 건너뛰지 못한다)
  if (stage === 1) {
    tweak(state);
    return state;
  }
  state.queue = [];
  state.stage = stage - 1;
  state.player.star = Number.MAX_SAFE_INTEGER;
  tweak(state);
  if ((stage - 1) % STAGE_BOSS_EVERY === 0) {
    // 보스 스테이지 다음은 거리가 아니라 "보스를 잡고 잠깐 쉬는" 타이머로 넘어간다
    state.bossActive = false;
    state.afterBossTimer = 1;
  } else {
    state.distance = state.stageStart + px(900);
  }
  step(state, { targetX: CENTER });
  return state;
}

describe('난수', () => {
  it('같은 시드면 같은 수열이고 부호 없는 32비트 정수다', () => {
    let a = 7;
    let b = 7;
    for (let i = 0; i < 100; i += 1) {
      const x = nextUint(a);
      const y = nextUint(b);
      a = x.next;
      b = y.next;
      expect(x.value).toBe(y.value);
      expect(Number.isInteger(x.value)).toBe(true);
      expect(x.value).toBeLessThan(2 ** 32);
    }
  });
});

describe('시작과 이동', () => {
  it('1스테이지, 도로 가운데, 기본 화력으로 시작한다', () => {
    const state = createState(1);
    expect(state.stage).toBe(1);
    expect(state.player.x).toBe(CENTER);
    expect(state.player.shots).toBe(PLAYER.startShots);
    expect(firepower(state.player)).toBe(Math.floor((PLAYER.startShots * PLAYER.startDamage * FPS) / PLAYER.startInterval));
    expect(state.over).toBe(false);
  });

  it('최대 속도로만 움직이고 도로 밖으로 나가지 않는다', () => {
    const state = emptied();
    step(state, { targetX: 0 });
    expect(state.player.x).toBe(CENTER - PLAYER.speed);
    play(state, 200, () => ({ targetX: -px(500) }));
    expect(state.player.x).toBe(PLAYER.width / 2);
    play(state, 200, () => ({ targetX: FIELD.width + px(500) }));
    expect(state.player.x).toBe(FIELD.width - PLAYER.width / 2);
  });

  it('달릴수록 도로가 흘러가고 달리는 속도는 스테이지가 오를수록 빨라진다(상한 있음)', () => {
    const state = emptied();
    play(state, 10);
    expect(state.scroll).toBe(10 * runSpeedFor(1));
    expect(runSpeedFor(10)).toBeGreaterThan(runSpeedFor(1));
    expect(runSpeedFor(999)).toBe(runSpeedFor(999 + 1));
  });
});

describe('사격', () => {
  it('자동으로 앞으로 쏜다', () => {
    const state = emptied();
    state.player.shots = 1;
    step(state, { targetX: CENTER });
    expect(state.bullets).toHaveLength(1);
    const z = state.bullets[0].z;
    step(state, { targetX: CENTER });
    expect(state.bullets[0].z).toBeGreaterThan(z);
  });

  it('총알 수가 늘면 한 번에 그만큼 나가고 부채꼴로 퍼진다', () => {
    const state = emptied();
    state.player.shots = 5;
    step(state, { targetX: CENTER });
    expect(state.bullets).toHaveLength(5);
    const vxs = state.bullets.map((b) => b.vx);
    expect(vxs[0]).toBeLessThan(0);
    expect(vxs[4]).toBeGreaterThan(0);
    expect(vxs[2]).toBe(0);
  });

  it('연사 간격만큼 쉬었다가 다시 쏜다', () => {
    const state = emptied();
    state.player.interval = 10;
    let volleys = 0;
    for (let i = 0; i < 30; i += 1) {
      const before = state.nextId;
      step(state, { targetX: CENTER });
      if (state.nextId > before) {
        volleys += 1;
      }
    }
    expect(volleys).toBe(3);
  });

  it('화력 숫자는 총알 수 × 공격력 × 초당 발사 횟수이고 치킨을 먹으면 연사가 두 배다', () => {
    const state = emptied();
    state.player.shots = 4;
    state.player.damage = 5;
    state.player.interval = 10;
    expect(firepower(state.player)).toBe(120);
    state.player.chicken = 100;
    expect(firepower(state.player)).toBe(240);
  });
});

describe('적과 점수', () => {
  it('총알로 적의 체력(숫자)을 깎고 다 깎으면 점수·처치 수가 오르고 kill 이벤트가 나온다', () => {
    const state = emptied();
    state.player.shots = 1;
    const enemy = enemyAt(state, 'grunt', CENTER, px(300), 10);
    const events: string[] = [];
    for (let i = 0; i < 120 && state.kills === 0; i += 1) {
      step(state, { targetX: CENTER });
      state.events.forEach((e) => events.push(e.t));
      if (state.kills === 0 && enemy.hp < 10) {
        expect(enemy.hp).toBeLessThan(10);
      }
    }
    expect(state.kills).toBe(1);
    expect(state.score).toBe(10);
    expect(events).toContain('kill');
  });

  it('거대 귤 덩어리는 체력이 크고 점수는 체력에 비례해 더 받는다', () => {
    const state = emptied();
    state.player.damage = 99;
    enemyAt(state, 'boulder', CENTER, px(300), 400, px(110));
    play(state, 120);
    expect(state.kills).toBe(1);
    expect(state.score).toBeGreaterThanOrEqual(100);
  });

  it('점수는 스테이지가 오를수록 조금씩 커진다', () => {
    const early = emptied();
    enemyAt(early, 'grunt', CENTER, px(300), 1);
    play(early, 80);
    const late = emptied();
    late.stage = 21;
    enemyAt(late, 'grunt', CENTER, px(300), 1);
    play(late, 80);
    expect(late.score).toBe(early.score * 3);
  });

  it('연속 처치하면 콤보 배율이 오르고, 한동안 못 잡으면 콤보가 끊긴다', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(999)).toBe(5);
    const state = emptied();
    enemyAt(state, 'grunt', CENTER, px(300), 1);
    play(state, 80);
    expect(state.combo).toBe(1);
    play(state, 120);
    expect(state.combo).toBe(0);
  });

  it('총알은 가장 가까운 적부터 맞힌다(앞의 적이 뒤의 적을 가린다)', () => {
    const state = emptied();
    state.player.shots = 1;
    const near = enemyAt(state, 'grunt', CENTER, px(200), 999);
    const far = enemyAt(state, 'grunt', CENTER, px(400), 999);
    play(state, 60);
    expect(near.hp).toBeLessThan(999);
    expect(far.hp).toBe(999);
  });

  it('무리는 도로롱 쪽으로 슬금슬금 몰려든다', () => {
    const state = emptied();
    const grunt = enemyAt(state, 'grunt', px(40), px(700), 999);
    grunt.speed = px(0.7);
    const startGap = Math.abs(state.player.x - grunt.x);
    play(state, 100);
    expect(Math.abs(state.player.x - grunt.x)).toBeLessThan(startGap);
    expect(grunt.z).toBeLessThan(px(700));
  });

  it('도전 배율은 완만하게 오르다 상한에서 멈춘다(그 뒤 난이도는 속도·개수·길 막기로 오른다)', () => {
    const percents = Array.from({ length: 80 }, (_, i) => challengePercent(i + 1));
    percents.forEach((p) => expect(Number.isInteger(p)).toBe(true));
    for (let i = 1; i < percents.length; i += 1) {
      expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
    }
    expect(percents[0]).toBeGreaterThanOrEqual(40);
    expect(percents[79]).toBe(55);
  });

  it('기준 화력은 치킨 같은 일시 효과를 빼고 센다', () => {
    const state = emptied();
    state.player.chicken = 100;
    expect(baseFirepower(state.player)).toBe(Math.floor((PLAYER.startShots * PLAYER.startDamage * FPS) / PLAYER.startInterval));
    expect(firepower(state.player)).toBeGreaterThan(baseFirepower(state.player));
  });
});

describe('스테이지 스폰', () => {
  it('스테이지를 달리면 게이트·귤 덩어리·무리가 차례로 나오고 체력은 기대 화력에서 정해진다', () => {
    const state = createState(3);
    const kinds = new Set<string>();
    state.player.star = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < 700 && state.stage === 1; i += 1) {
      step(state, { targetX: CENTER });
      state.enemies.forEach((e) => kinds.add(e.kind));
      if (state.gates.length > 0) {
        kinds.add('gate');
      }
    }
    expect(kinds.has('gate')).toBe(true);
    expect(kinds.has('boulder')).toBe(true);
    expect(kinds.has('grunt')).toBe(true);
    const boulder = state.enemies.find((e) => e.kind === 'boulder');
    if (boulder) {
      // 스테이지 1: 내 화력 45 × 접근 시간 11초 × 도전 배율 41% × 적중 계수 32% × (60~140%)
      expect(boulder.maxHp).toBeGreaterThanOrEqual(35);
      expect(boulder.maxHp).toBeLessThanOrEqual(95);
    }
  });

  /** 다음 스테이지를 계획하게 만들고 그때 큐에 들어간 귤 덩어리의 체력을 돌려준다. */
  function boulderHpsAfterNextStage(shots: number, damage: number, stage = 1): number[] {
    const state = planStage(5, stage, (s) => {
      s.player.shots = shots;
      s.player.damage = damage;
    });
    return state.queue.filter((q) => q.kind === 'boulder').map((q) => q.hp ?? 0);
  }

  it('적의 체력은 내 현재 화력이 아니라 이 스테이지의 한계 화력에서 정해진다(그래서 약하면 정말 못 부순다)', () => {
    const weak = boulderHpsAfterNextStage(1, 1);
    const strong = boulderHpsAfterNextStage(16, 40);
    expect(weak.length).toBeGreaterThan(0);
    expect(strong).toEqual(weak);
    // 스테이지가 오르면 같은 모양의 귤 덩어리라도 체력 숫자가 커진다
    const later = boulderHpsAfterNextStage(3, 3, 31);
    expect(Math.max(...later)).toBeGreaterThan(Math.max(...weak) * 20);
    expect(anchorFirepower(30)).toBeGreaterThan(anchorFirepower(10));
  });

  it('이미 상한에 닿은 스탯의 게이트는 나오지 않고 공격력 게이트로 바뀐다', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = createState(seed);
      state.queue = [];
      state.player.shots = shotsCap(15);
      state.player.interval = intervalFloor(15);
      state.player.damage = 1;
      state.player.star = Number.MAX_SAFE_INTEGER;
      state.stage = 14;
      state.distance = state.stageStart + px(900);
      step(state, { targetX: CENTER });
      state.queue.filter((q) => q.kind === 'gate').forEach((q) => {
        q.gate?.zones.forEach((zone) => kinds.add(zone.effect.kind));
      });
    }
    expect(kinds.has('shotsUp')).toBe(false);
    expect(kinds.has('shotsMul')).toBe(false);
    expect(kinds.has('rateUp')).toBe(false);
    expect(kinds.has('dmgUp')).toBe(true);
  });

  it('일정 거리를 달리면 다음 스테이지로 넘어가고 보너스를 받는다', () => {
    const state = createState(3);
    state.player.star = Number.MAX_SAFE_INTEGER;
    const before = state.score;
    play(state, 1000);
    expect(state.stage).toBeGreaterThanOrEqual(2);
    expect(state.score).toBeGreaterThan(before);
  });
});

describe('게이트', () => {
  it('지나가는 쪽 게이트의 효과만 적용된다', () => {
    const left = emptied(1, 40);
    gateAt(left, px(40), effect('shotsUp', 3), effect('dmgUp', 5));
    play(left, 60, () => ({ targetX: px(40) }));
    expect(left.player.shots).toBeGreaterThanOrEqual(PLAYER.startShots + 3);
    expect(left.player.damage).toBe(PLAYER.startDamage);

    const right = emptied(1, 40);
    gateAt(right, px(40), effect('shotsUp', 3), effect('dmgUp', 5));
    play(right, 60, () => ({ targetX: FIELD.width - px(40) }));
    expect(right.player.shots).toBe(PLAYER.startShots);
    expect(right.player.damage).toBe(PLAYER.startDamage + 5);
  });

  it('배수·연사·함정 게이트의 효과', () => {
    const cases: [GateEffect, (s: OrangeState) => void, (s: OrangeState) => number][] = [
      [effect('shotsMul', 2), (s) => { s.player.shots = 6; }, (s) => s.player.shots],
      [effect('rateUp', 4), () => undefined, (s) => s.player.interval],
      [effect('shotsDown', 2), (s) => { s.player.shots = 5; }, (s) => s.player.shots],
      [effect('shotsHalf', 2), (s) => { s.player.shots = 9; }, (s) => s.player.shots],
    ];
    const expected = [12, PLAYER.startInterval - 4, 3, 4];
    cases.forEach(([chosen, setup, read], i) => {
      const state = emptied(1, 40);
      setup(state);
      gateAt(state, px(40), chosen, effect('dmgUp', 1));
      play(state, 60, () => ({ targetX: px(40) }));
      expect(read(state)).toBe(expected[i]);
    });
  });

  it('총알 수·공격력·연사에는 이 스테이지의 상한이 있고 함정으로도 1 아래로 내려가지 않는다', () => {
    const capped = emptied();
    capped.player.shots = shotsCap(1);
    capped.player.damage = damageCap(1);
    capped.player.interval = intervalFloor(1);
    gateAt(capped, px(40), effect('shotsMul', 2), effect('dmgUp', 50));
    play(capped, 60, () => ({ targetX: px(40) }));
    expect(capped.player.shots).toBe(shotsCap(1));
    gateAt(capped, px(40), effect('dmgUp', 50), effect('shotsUp', 1));
    play(capped, 60, () => ({ targetX: px(40) }));
    expect(capped.player.damage).toBe(damageCap(1));
    gateAt(capped, px(40), effect('rateUp', 50), effect('shotsUp', 1));
    play(capped, 60, () => ({ targetX: px(40) }));
    expect(capped.player.interval).toBe(intervalFloor(1));

    const low = emptied();
    gateAt(low, px(40), effect('shotsDown', 9), effect('dmgUp', 1));
    play(low, 60, () => ({ targetX: px(40) }));
    expect(low.player.shots).toBe(1);
  });

  it('스테이지가 오르면 상한도 오른다(성장이 끝나지 않는다)', () => {
    for (let stage = 2; stage <= SCALING_STAGE_LIMIT; stage += 1) {
      expect(damageCap(stage)).toBeGreaterThan(damageCap(stage - 1));
      expect(firepowerCap(stage)).toBeGreaterThanOrEqual(firepowerCap(stage - 1));
      expect(shotsCap(stage)).toBeGreaterThanOrEqual(shotsCap(stage - 1));
      expect(intervalFloor(stage)).toBeLessThanOrEqual(intervalFloor(stage - 1));
    }
    expect(damageCap(50)).toBeGreaterThan(damageCap(20) * 10);
    expect(shotsCap(99)).toBe(PLAYER.maxShots);
    expect(intervalFloor(99)).toBe(PLAYER.minInterval);
  });

  it('성장은 정해진 스테이지에서 멈추고, 어떤 스테이지에서도 모든 수치가 JS 가 정확히 다루는 정수 안에 머문다', () => {
    expect(damageCap(SCALING_STAGE_LIMIT + 500)).toBe(damageCap(SCALING_STAGE_LIMIT));
    for (const stage of [SCALING_STAGE_LIMIT, 200, 5000, 1_000_000]) {
      const state = createState(7);
      state.queue = [];
      state.stage = stage - 1;
      state.player.shots = shotsCap(stage);
      state.player.damage = damageCap(stage);
      state.player.interval = intervalFloor(stage);
      state.player.star = Number.MAX_SAFE_INTEGER;
      state.distance = state.stageStart + px(900);
      step(state, { targetX: CENTER });
      const values: number[] = [firepower(state.player), firepowerCap(stage), baseFirepower(state.player), state.score];
      state.queue.forEach((q) => values.push(q.hp ?? 0, q.at, q.x, q.count ?? 0));
      state.enemies.forEach((e) => values.push(e.hp, e.maxHp));
      values.forEach((v) => expect(Number.isSafeInteger(v), `stage ${stage}: ${v}`).toBe(true));
      // 체력 계산의 곱셈 중간값(기준 화력 × 11초 × 적중 계수 → × 도전 배율 × 변동)도 안전 한계의 1/10 아래
      expect(Math.floor((anchorFirepower(stage) * 11 * 32) / 100) * challengePercent(stage) * 139).toBeLessThan(Number.MAX_SAFE_INTEGER / 10);
    }
  });

  it('총알은 게이트를 통과해 뒤의 적을 맞히고, 총알 하나는 게이트를 한 번만 센다', () => {
    const state = emptied(1, 40);
    state.player.x = px(40);
    state.player.shots = 1;
    state.player.interval = 1000;
    const gate = gateAt(state, px(300), effect('shotsUp', 2), effect('dmgUp', 1));
    const enemy = enemyAt(state, 'grunt', px(40), px(600), 99);
    play(state, 80, () => ({ targetX: px(40) }));
    expect(gate.zones[0].effect.hits).toBe(1);
    expect(gate.zones[1].effect.hits).toBe(0);
    expect(enemy.hp).toBeLessThan(99);
  });

  it('총알 수 게이트는 30발마다 1씩 오르고 한도(원래 값+3)를 넘지 않는다', () => {
    const state = emptied(1, 40);
    state.player.x = px(40);
    state.player.damage = 1;
    const gate = gateAt(state, px(500), effect('shotsUp', 2), effect('dmgUp', 1));
    gate.z = px(500);
    state.player.shots = 6;
    play(state, 150, () => ({ targetX: px(40) }));
    expect(gate.zones[0].effect.hits).toBeGreaterThanOrEqual(30);
    expect(gate.zones[0].effect.value).toBeGreaterThan(2);
    expect(gate.zones[0].effect.value).toBeLessThanOrEqual(2 + 3);
  });
});

describe('보호막과 한 방 컷', () => {
  it('귤(보호막)이 없으면 부딪히는 순간 끝난다', () => {
    const state = emptied();
    enemyAt(state, 'grunt', CENTER, 0, 999);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(true);
    expect(state.events.some((e) => e.t === 'over')).toBe(true);
  });

  it('이미 지나쳐 뒤에 있는 적에게는 옆으로 움직여 들어가도 부딪히지 않는다', () => {
    const state = emptied();
    state.player.x = px(100);
    enemyAt(state, 'boulder', px(180), -px(30), 999, px(100));
    play(state, 12, () => ({ targetX: px(180) }));
    expect(state.over).toBe(false);
  });

  it('길에서 비켜서면 부딪히지 않는다', () => {
    const state = emptied();
    enemyAt(state, 'boulder', px(60), 0, 999, px(100));
    step(state, { targetX: px(300) });
    play(state, 30, () => ({ targetX: px(300) }));
    expect(state.over).toBe(false);
  });

  it('보호막은 한 번만 막아 주고 막은 적은 부서지며, 그 뒤 잠깐은 무적이다', () => {
    const state = emptied();
    state.player.shield = 1;
    enemyAt(state, 'grunt', CENTER, 0, 999);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(false);
    expect(state.player.shield).toBe(0);
    expect(state.player.invuln).toBeGreaterThan(0);
    expect(state.enemies).toHaveLength(0);
    enemyAt(state, 'grunt', CENTER, 0, 999);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(false);
    play(state, PLAYER.invulnTicksAfterShield + 1);
    enemyAt(state, 'grunt', CENTER, 0, 999);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(true);
  });

  it('별(무적) 동안에는 닿아도 괜찮다', () => {
    const state = emptied();
    state.player.star = 100;
    enemyAt(state, 'grunt', CENTER, 0, 999);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(false);
  });
});

describe('아이템', () => {
  it('귤은 보호막(최대 2), 치킨은 연사, 돈다발은 점수 2배, 별은 무적, 관통은 관통 상태', () => {
    const state = emptied();
    (['orange', 'orange', 'orange', 'chicken', 'cash', 'star', 'pierce'] as const).forEach((kind) =>
      state.items.push({ id: state.nextId++, kind, x: CENTER, z: 0 }),
    );
    step(state, { targetX: CENTER });
    expect(state.player.shield).toBe(PLAYER.maxShield);
    expect(state.player.chicken).toBeGreaterThan(0);
    expect(state.player.cash).toBeGreaterThan(0);
    expect(state.player.star).toBeGreaterThan(0);
    expect(state.player.pierce).toBeGreaterThan(0);
  });

  it('다른 길로 가면 아이템을 놓친다', () => {
    const state = emptied();
    state.items.push({ id: state.nextId++, kind: 'orange', x: px(40), z: px(200) });
    play(state, 200, () => ({ targetX: px(320) }));
    expect(state.player.shield).toBe(0);
    expect(state.items).toHaveLength(0);
  });

  it('돈다발 효과 중에는 점수가 두 배다', () => {
    const state = emptied();
    state.player.cash = 600;
    enemyAt(state, 'grunt', CENTER, px(300), 1);
    play(state, 80);
    expect(state.score).toBe(20);
  });

  it('관통 상태의 총알은 앞의 적을 뚫고 뒤의 적도 맞힌다', () => {
    const state = emptied();
    state.player.shots = 1;
    state.player.interval = 1000;
    state.player.pierce = 600;
    const a = enemyAt(state, 'grunt', CENTER, px(300), 99);
    const b = enemyAt(state, 'grunt', CENTER, px(380), 99);
    const c = enemyAt(state, 'grunt', CENTER, px(460), 99);
    play(state, 80);
    expect(a.hp).toBeLessThan(99);
    expect(b.hp).toBeLessThan(99);
    expect(c.hp).toBeLessThan(99);
  });

  it('귤 폭탄은 가까이 있는 적에게만 한꺼번에 피해를 준다', () => {
    const state = emptied();
    state.player.interval = 1000;
    state.player.cooldown = 1000;
    const near = enemyAt(state, 'boulder', CENTER, px(200), 5000);
    const far = enemyAt(state, 'boulder', CENTER, px(900), 5000);
    state.items.push({ id: state.nextId++, kind: 'bomb', x: CENTER, z: 0 });
    step(state, { targetX: CENTER });
    expect(near.hp).toBeLessThan(5000);
    expect(far.hp).toBe(5000);
    expect(state.events.some((e) => e.t === 'bomb')).toBe(true);
  });
});

describe('보스', () => {
  function toBossStage(seed = 3): OrangeState {
    const state = createState(seed);
    state.stage = STAGE_BOSS_EVERY - 1;
    state.queue = [];
    state.enemies = [];
    state.gates = [];
    state.stageStart = state.distance;
    // 다음 스테이지로 넘어가게 거리를 채운다
    state.distance = state.stageStart + px(900);
    play(state, 1);
    return state;
  }

  it('10스테이지마다 보스 스테이지가 되어 보스가 등장하고, 자리를 잡으면 멈춰 서서 덤벨을 던진다', () => {
    const state = toBossStage();
    expect(state.stage).toBe(STAGE_BOSS_EVERY);
    expect(state.bossActive).toBe(true);
    state.player.star = Number.MAX_SAFE_INTEGER;
    state.player.cooldown = 1e9;
    let maxDumbbells = 0;
    let scrollWhileHolding = -1;
    for (let i = 0; i < 700; i += 1) {
      step(state, { targetX: CENTER });
      maxDumbbells = Math.max(maxDumbbells, state.dumbbells.length);
      const boss = state.enemies.find((e) => e.kind === 'boss');
      if (boss && boss.z <= px(340)) {
        if (scrollWhileHolding < 0) {
          scrollWhileHolding = state.scroll;
        } else {
          expect(state.scroll).toBe(scrollWhileHolding);
        }
      }
    }
    expect(maxDumbbells).toBeGreaterThan(0);
    expect(scrollWhileHolding).toBeGreaterThan(0);
  });

  it('보스를 쓰러뜨리면 보너스·귤·게이트가 나오고 잠시 뒤 다음 스테이지가 시작된다', () => {
    const state = toBossStage();
    state.player.star = Number.MAX_SAFE_INTEGER;
    state.player.damage = 2000;
    state.player.shots = PLAYER.maxShots;
    state.player.interval = PLAYER.minInterval;
    const events: string[] = [];
    for (let i = 0; i < 6000 && state.stage === STAGE_BOSS_EVERY; i += 1) {
      step(state, { targetX: CENTER });
      state.events.forEach((e) => events.push(e.t));
    }
    expect(events).toContain('bossDown');
    expect(state.stage).toBe(STAGE_BOSS_EVERY + 1);
    expect(state.score).toBeGreaterThan(2000);
  });
});

describe('결정성과 정수', () => {
  const wiggle = (s: OrangeState): OrangeInput => ({ targetX: CENTER + ((s.tick >> 5) % 2 === 0 ? -px(90) : px(90)) });

  it('같은 시드와 같은 입력이면 결과가 같다', () => {
    expect(play(createState(42), FPS * 30, wiggle)).toEqual(play(createState(42), FPS * 30, wiggle));
  });

  it('시드가 다르면 전개가 달라진다', () => {
    const a = play(createState(1), FPS * 10, wiggle);
    const b = play(createState(2), FPS * 10, wiggle);
    expect(JSON.stringify(a.queue)).not.toBe(JSON.stringify(b.queue));
  });

  it('긴 판을 돌려도 모든 좌표와 수치가 정수다(부동소수점이 없다)', () => {
    const state = createState(5);
    state.player.star = Number.MAX_SAFE_INTEGER;
    state.player.damage = 2000;
    state.player.shots = 10;
    for (let i = 0; i < FPS * 120; i += 1) {
      step(state, wiggle(state));
      const numbers: number[] = [
        state.player.x, state.score, state.combo, state.distance, state.scroll,
        ...state.bullets.flatMap((b) => [b.x, b.z, b.vx]),
        ...state.enemies.flatMap((e) => [e.x, e.z, e.hp, e.w]),
        ...state.dumbbells.flatMap((d) => [d.x, d.z, d.vx]),
        ...state.gates.map((g) => g.z), ...state.items.flatMap((it) => [it.x, it.z]),
      ];
      const bad = numbers.find((n) => !Number.isInteger(n));
      expect(bad, `tick ${state.tick}`).toBeUndefined();
    }
    expect(PX).toBe(100);
  });
});

describe('5줄 도로', () => {
  it('도로는 5줄이고 줄 폭은 도로 폭의 1/5 이다', () => {
    expect(LANE_COUNT).toBe(5);
    expect(LANE_WIDTH * LANE_COUNT).toBe(FIELD.width);
  });

  it('귤 덩어리는 어느 줄 배치에서도 연속 2줄 이상의 통로를 남긴다(공격력이 없어도 움직임만으로 피할 수 있다)', () => {
    const corridor = LANE_WIDTH * 2 - px(20);
    for (let seed = 1; seed <= 150; seed += 1) {
      for (const stage of [1, 5, 9, 14, 25, 61, 99, 101, 141]) {
        const state = planStage(seed, stage);
        const boulders = state.queue.filter((q) => q.kind === 'boulder');
        // 같은 줄(깊이가 비슷한 것)끼리 묶는다
        const bands = new Map<number, typeof boulders>();
        boulders.forEach((b) => {
          const key = Math.floor((b.at - state.stageStart) / px(100));
          bands.set(key, [...(bands.get(key) ?? []), b]);
        });
        bands.forEach((band) => {
          const spans = band.map((b) => [b.x - (b.w ?? 0) / 2, b.x + (b.w ?? 0) / 2]).sort((x, y) => x[0] - y[0]);
          let cursor = 0;
          let widest = 0;
          spans.forEach(([from, to]) => {
            widest = Math.max(widest, from - cursor);
            cursor = Math.max(cursor, to);
          });
          widest = Math.max(widest, FIELD.width - cursor);
          expect(widest, `seed ${seed} stage ${stage}`).toBeGreaterThanOrEqual(corridor);
        });
      }
    }
  });
});

describe('게이트 변칙', () => {
  function plans(stage: number, seeds = 120): Gate['zones'][] {
    const result: Gate['zones'][] = [];
    for (let seed = 1; seed <= seeds; seed += 1) {
      const state = planStage(seed, stage);
      const gate = state.queue.find((q) => q.kind === 'gate')?.gate;
      if (gate) {
        result.push(gate.zones);
      }
    }
    return result;
  }

  it('칸은 도로 전체를 빈틈없이 줄 단위로 나눈다', () => {
    [3, 14, 31, 61].forEach((stage) =>
      plans(stage).forEach((zones) => {
        expect(zones[0].x0).toBe(0);
        expect(zones[zones.length - 1].x1).toBe(FIELD.width);
        zones.forEach((zone, i) => {
          expect(zone.x1 - zone.x0).toBeGreaterThan(0);
          expect((zone.x1 - zone.x0) % LANE_WIDTH).toBe(0);
          if (i > 0) {
            expect(zone.x0).toBe(zones[i - 1].x1);
          }
        });
      }),
    );
  });

  it('초반에는 두 칸뿐이고 12스테이지부터 3분할, 25스테이지부터 5분할이 나온다', () => {
    expect(new Set(plans(5).map((z) => z.length))).toEqual(new Set([2]));
    expect(new Set(plans(14, 200).map((z) => z.length)).has(3)).toBe(true);
    expect(new Set(plans(31, 300).map((z) => z.length)).has(5)).toBe(true);
    expect(new Set(plans(14, 200).map((z) => z.length)).has(5)).toBe(false);
  });

  it('후반에는 이로운 칸이 좁고 나쁜 칸이 훨씬 넓다(좋은 칸 폭 < 나쁜 칸 폭)', () => {
    let goodWidth = 0;
    let badWidth = 0;
    plans(41, 300).forEach((zones) =>
      zones.forEach((zone) => {
        if (zone.hidden) {
          return;
        }
        const bad = ['shotsDown', 'shotsHalf', 'dmgDown', 'rateDown'].includes(zone.effect.kind);
        if (bad) {
          badWidth += zone.x1 - zone.x0;
        } else {
          goodWidth += zone.x1 - zone.x0;
        }
      }),
    );
    expect(badWidth).toBeGreaterThan(goodWidth * 2);
  });

  it('가려진 칸(?)은 8스테이지부터 나온다', () => {
    expect(plans(5, 300).some((zones) => zones.some((z) => z.hidden))).toBe(false);
    expect(plans(21, 300).some((zones) => zones.some((z) => z.hidden))).toBe(true);
  });

  it('흔들리는 게이트는 15스테이지부터 나오고, 어느 순간에도 칸이 도로를 빈틈없이 나눈다', () => {
    const swaying = (stage: number): Gate[] => {
      const gates: Gate[] = [];
      for (let seed = 1; seed <= 200; seed += 1) {
        const g = planStage(seed, stage).queue.find((q) => q.kind === 'gate')?.gate;
        if (g) {
          gates.push({ id: seed, z: 0, zones: g.zones, sway: g.sway, used: false });
        }
      }
      return gates.filter((g) => g.sway > 0);
    };
    expect(swaying(11)).toHaveLength(0);
    const moving = swaying(31);
    expect(moving.length).toBeGreaterThan(0);
    moving.forEach((gate) => {
      for (let tick = 0; tick < 480; tick += 7) {
        const bounds = gateBounds(gate, tick);
        expect(bounds[0].x0).toBe(0);
        expect(bounds[bounds.length - 1].x1).toBe(FIELD.width);
        bounds.forEach((b, i) => {
          expect(b.x1).toBeGreaterThan(b.x0);
          if (i > 0) {
            expect(b.x0).toBe(bounds[i - 1].x1);
          }
        });
        // 어떤 x 에서든 칸이 정해지고, 그 칸의 범위 안에 있다
        for (let x = 0; x < FIELD.width; x += px(25)) {
          const zone = gateZoneAt(gate, tick, x);
          const index = gate.zones.indexOf(zone);
          expect(x).toBeGreaterThanOrEqual(bounds[index].x0);
          expect(x).toBeLessThan(bounds[index].x1);
        }
      }
    });
  });

  it('공격력 감소·연사 느려짐 함정은 값을 깎되 1 아래·가장 느린 간격을 넘지 않는다', () => {
    const state = emptied(1, 40);
    state.player.damage = 100;
    state.player.interval = 12;
    gateAt(state, px(40), effect('dmgDown', 30), effect('rateDown', 2));
    play(state, 60, () => ({ targetX: px(40) }));
    expect(state.player.damage).toBe(70);

    const right = emptied(1, 40);
    right.player.interval = PLAYER.slowestInterval - 1;
    gateAt(right, px(40), effect('dmgDown', 30), effect('rateDown', 5));
    play(right, 60, () => ({ targetX: FIELD.width - px(40) }));
    expect(right.player.interval).toBe(PLAYER.slowestInterval);

    const tiny = emptied(1, 40);
    tiny.player.damage = 1;
    gateAt(tiny, px(40), effect('dmgDown', 90), effect('dmgUp', 1));
    play(tiny, 60, () => ({ targetX: px(40) }));
    expect(tiny.player.damage).toBe(1);
  });

  it('줄마다 칸이 다른 게이트에서는 서 있는 칸의 효과만 적용된다', () => {
    const state = emptied(1, 40);
    const effects = [effect('shotsDown', 1), effect('dmgDown', 20), effect('shotsUp', 3), effect('rateDown', 2), effect('shotsHalf', 2)];
    const zones: GateZone[] = effects.map((e, i) => ({ x0: i * LANE_WIDTH, x1: (i + 1) * LANE_WIDTH, effect: e, hidden: false }));
    state.gates.push({ id: state.nextId++, z: px(40), zones, sway: 0, used: false });
    const target = LANE_WIDTH * 2 + LANE_WIDTH / 2;
    state.player.x = target;
    play(state, 60, () => ({ targetX: target }));
    expect(state.player.shots).toBe(PLAYER.startShots + 3);
  });
});

describe('무한 모드', () => {
  it('100스테이지에서 무한 모드가 시작되고 그때 한 번만 알린다', () => {
    expect(INFINITE_FROM_STAGE).toBe(100);
    expect(isInfinite(99)).toBe(false);
    expect(isInfinite(100)).toBe(true);
    const seen: number[] = [];
    for (const stage of [98, 99, 100, 101]) {
      const state = planStage(3, stage);
      if (state.events.some((e) => e.t === 'infinite')) {
        seen.push(state.stage);
      }
    }
    expect(seen).toEqual([100]);
  });

  it('무한 모드에서는 도전 배율·몰려오는 속도가 스테이지마다 계속 오른다(상한은 안전을 위한 아주 큰 값)', () => {
    expect(infiniteLevel(99)).toBe(0);
    expect(infiniteLevel(100)).toBe(1);
    expect(crowdSpeedBonus(99)).toBe(0);
    let previousChallenge = challengePercent(99);
    let previousSpeed = crowdSpeedBonus(99);
    for (let stage = 100; stage <= 140; stage += 1) {
      expect(challengePercent(stage)).toBeGreaterThan(previousChallenge);
      expect(crowdSpeedBonus(stage)).toBeGreaterThan(previousSpeed);
      expect(runSpeedFor(stage)).toBeGreaterThanOrEqual(runSpeedFor(stage - 1));
      previousChallenge = challengePercent(stage);
      previousSpeed = crowdSpeedBonus(stage);
    }
    // 상한: 한없이 커지지 않는다(정수 안전)
    expect(challengePercent(10_000_000)).toBe(challengePercent(1_000_000));
    expect(crowdSpeedBonus(10_000_000)).toBe(crowdSpeedBonus(1_000_000));
  });

  it('몰려오는 적(무리·덩치)의 속도가 무한 모드에서 점점 빨라진다', () => {
    const speedOf = (stage: number): number => {
      const state = planStage(7, stage % STAGE_BOSS_EVERY === 0 ? stage + 1 : stage);
      state.queue = [];
      state.player.shots = 1;
      state.distance += px(5000);
      const crowdState = createState(7);
      crowdState.stage = stage;
      crowdState.queue = [{ at: 0, kind: 'crowd', x: CENTER, hp: 5, count: 3 }];
      crowdState.stageStart = Number.MAX_SAFE_INTEGER / 2;
      crowdState.player.star = Number.MAX_SAFE_INTEGER;
      step(crowdState, { targetX: CENTER });
      return crowdState.enemies[0].speed;
    };
    expect(speedOf(130)).toBeGreaterThan(speedOf(110));
    expect(speedOf(110)).toBeGreaterThan(speedOf(99));
    expect(speedOf(99)).toBe(speedOf(50));
  });
});
