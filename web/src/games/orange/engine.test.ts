import { describe, expect, it } from 'vitest';
import {
  FIELD,
  FPS,
  PLAYER,
  PX,
  WAVE_BOSS_EVERY,
  comboMultiplier,
  createState,
  effect,
  hpScalePercent,
  nextUint,
  px,
  step,
  type Enemy,
  type Gate,
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

function enemyAt(state: OrangeState, kind: Enemy['kind'], x: number, y: number, hp = 1): Enemy {
  const enemy: Enemy = {
    id: state.nextId++, kind, baseX: x, x, y, w: px(30), h: px(30), hp, maxHp: hp, vy: 0, vx: 0, flash: 0, shielded: 0, born: state.tick,
  };
  state.enemies.push(enemy);
  return enemy;
}

/** 새 웨이브의 자동 생성물을 치우고 판을 비운 상태로 만든다(규칙을 하나씩 확인하려고). */
function emptied(seed = 1): OrangeState {
  const state = createState(seed);
  state.queue = [];
  state.waveLength = Number.MAX_SAFE_INTEGER;
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
      expect(x.value).toBeGreaterThanOrEqual(0);
      expect(x.value).toBeLessThan(2 ** 32);
    }
  });
});

describe('시작과 이동', () => {
  it('1웨이브, 화면 가운데, 기본 화력으로 시작한다', () => {
    const state = createState(1);
    expect(state.wave).toBe(1);
    expect(state.player.x).toBe(CENTER);
    expect(state.player.shots).toBe(PLAYER.startShots);
    expect(state.over).toBe(false);
  });

  it('최대 속도로만 움직이고 화면 밖으로 나가지 않는다', () => {
    const state = emptied();
    step(state, { targetX: 0 });
    expect(state.player.x).toBe(CENTER - PLAYER.speed);
    play(state, 200, () => ({ targetX: -px(500) }));
    expect(state.player.x).toBe(PLAYER.width / 2);
    play(state, 200, () => ({ targetX: FIELD.width + px(500) }));
    expect(state.player.x).toBe(FIELD.width - PLAYER.width / 2);
  });
});

describe('사격', () => {
  it('자동으로 쏘고 총알이 위로 날아간다', () => {
    const state = emptied();
    state.player.shots = 1;
    step(state, { targetX: CENTER });
    expect(state.bullets).toHaveLength(1);
    const y = state.bullets[0].y;
    step(state, { targetX: CENTER });
    expect(state.bullets[0].y).toBeLessThan(y);
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
    let shotsFired = 0;
    for (let i = 0; i < 30; i += 1) {
      const before = state.nextId;
      step(state, { targetX: CENTER });
      if (state.nextId > before) {
        shotsFired += 1;
      }
    }
    expect(shotsFired).toBe(3);
  });
});

describe('적과 점수', () => {
  it('총알로 적을 쓰러뜨리면 점수와 처치 수가 오르고 kill 이벤트가 나온다', () => {
    const state = emptied();
    enemyAt(state, 'swarm', CENTER, px(400), 1);
    const events: string[] = [];
    for (let i = 0; i < 60 && state.kills === 0; i += 1) {
      step(state, { targetX: CENTER });
      state.events.forEach((e) => events.push(e.t));
    }
    expect(state.kills).toBe(1);
    expect(state.score).toBe(10);
    expect(events).toContain('kill');
  });

  it('연속 처치하면 콤보 배율이 올라가고, 한동안 못 잡으면 콤보가 끊긴다', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(999)).toBe(5);
    const state = emptied();
    enemyAt(state, 'swarm', CENTER, px(400), 1);
    play(state, 60, () => ({ targetX: CENTER }));
    expect(state.combo).toBe(1);
    play(state, 120, () => ({ targetX: CENTER }));
    expect(state.combo).toBe(0);
  });

  it('슬라임은 죽으면 작은 슬라임 둘로 갈라진다', () => {
    const state = emptied();
    state.player.damage = 99;
    enemyAt(state, 'slime', CENTER, px(400), 5);
    for (let i = 0; i < 60 && state.kills === 0; i += 1) {
      step(state, { targetX: CENTER });
    }
    expect(state.enemies.filter((e) => e.kind === 'mini')).toHaveLength(2);
  });

  it('웨이브가 올라가면 체력 배율이 커진다', () => {
    expect(hpScalePercent(1)).toBe(100);
    expect(hpScalePercent(11)).toBeGreaterThan(hpScalePercent(2));
  });
});

describe('게이트', () => {
  function gateAt(state: OrangeState, left: Gate['left'], right: Gate['right']): Gate {
    const gate: Gate = { id: state.nextId++, y: PLAYER.y - px(70), left, right, used: false };
    state.gates.push(gate);
    return gate;
  }

  it('지나가는 쪽 게이트의 효과만 적용된다', () => {
    const left = emptied();
    gateAt(left, effect('shotsUp', 3), effect('dmgUp', 5));
    play(left, 80, () => ({ targetX: px(40) }));
    // 게이트 아래에서 쏘면 값이 조금 오를 수 있으므로 최소한 원래 값만큼은 늘어난다
    expect(left.player.shots).toBeGreaterThanOrEqual(PLAYER.startShots + 3);
    expect(left.player.damage).toBe(PLAYER.startDamage);

    const right = emptied();
    gateAt(right, effect('shotsUp', 3), effect('dmgUp', 5));
    play(right, 80, () => ({ targetX: FIELD.width - px(40) }));
    expect(right.player.shots).toBe(PLAYER.startShots);
    expect(right.player.damage).toBe(PLAYER.startDamage + 5);
  });

  it('배수·연사·함정 게이트의 효과', () => {
    const cases: [Gate['left'], (s: OrangeState) => void, (s: OrangeState) => number][] = [
      [effect('shotsMul', 2), (s) => { s.player.shots = 6; }, (s) => s.player.shots],
      [effect('rateUp', 4), () => undefined, (s) => s.player.interval],
      [effect('shotsDown', 2), (s) => { s.player.shots = 5; }, (s) => s.player.shots],
      [effect('shotsHalf', 2), (s) => { s.player.shots = 9; }, (s) => s.player.shots],
    ];
    const expected = [12, PLAYER.startInterval - 4, 3, 4];
    cases.forEach(([chosen, setup, read], i) => {
      const state = emptied();
      setup(state);
      gateAt(state, chosen, effect('dmgUp', 1));
      play(state, 80, () => ({ targetX: px(40) }));
      expect(read(state)).toBe(expected[i]);
    });
  });

  it('총알 수는 한계를 넘지 않고 함정으로도 1 아래로 내려가지 않는다', () => {
    const state = emptied();
    state.player.shots = 30;
    gateAt(state, effect('shotsMul', 2), effect('dmgUp', 1));
    play(state, 80, () => ({ targetX: px(40) }));
    expect(state.player.shots).toBe(PLAYER.maxShots);

    const low = emptied();
    gateAt(low, effect('shotsDown', 9), effect('dmgUp', 1));
    play(low, 80, () => ({ targetX: px(40) }));
    expect(low.player.shots).toBe(1);
  });

  it('게이트를 쏘면 총알 수 게이트는 8발마다 1씩 오르고 한도(원래 값+8)를 넘지 않는다(총알은 게이트에 막힌다)', () => {
    const state = emptied();
    const gate = gateAt(state, effect('shotsUp', 2), effect('dmgUp', 1));
    gate.y = px(300);
    state.player.x = px(40);
    play(state, 120, () => ({ targetX: px(40) }));
    expect(gate.left.hits).toBeGreaterThanOrEqual(8);
    expect(gate.left.value).toBeGreaterThan(2);
    expect(gate.right.hits).toBe(0);
  });
});

describe('보호막과 한 방 컷', () => {
  it('귤(보호막)이 없으면 적에게 닿는 순간 끝난다', () => {
    const state = emptied();
    enemyAt(state, 'swarm', CENTER, PLAYER.y, 99);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(true);
    expect(state.events.some((e) => e.t === 'over')).toBe(true);
  });

  it('보호막은 한 번만 막아 주고, 막은 뒤 잠깐은 무적이다', () => {
    const state = emptied();
    state.player.shield = 1;
    enemyAt(state, 'swarm', CENTER, PLAYER.y, 99);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(false);
    expect(state.player.shield).toBe(0);
    expect(state.player.invuln).toBeGreaterThan(0);
    enemyAt(state, 'swarm', CENTER, PLAYER.y, 99);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(false);
    play(state, PLAYER.invulnTicksAfterShield + 1, () => ({ targetX: CENTER }));
    enemyAt(state, 'swarm', CENTER, PLAYER.y, 99);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(true);
  });

  it('적이 바닥선을 넘어가도 한 번 맞은 것으로 친다', () => {
    const state = emptied();
    enemyAt(state, 'swarm', px(40), FIELD.height + px(30), 99);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(true);
  });

  it('별(무적) 동안에는 닿아도 괜찮다', () => {
    const state = emptied();
    state.player.star = 100;
    enemyAt(state, 'swarm', CENTER, PLAYER.y, 99);
    step(state, { targetX: CENTER });
    expect(state.over).toBe(false);
  });
});

describe('아이템', () => {
  it('귤은 보호막(최대 2), 치킨은 연사, 돈다발은 점수 2배, 별은 무적', () => {
    const kinds = ['orange', 'orange', 'orange', 'chicken', 'cash', 'star'] as const;
    const state = emptied();
    kinds.forEach((kind) => state.items.push({ id: state.nextId++, kind, x: CENTER, y: PLAYER.y }));
    step(state, { targetX: CENTER });
    expect(state.player.shield).toBe(PLAYER.maxShield);
    expect(state.player.chicken).toBeGreaterThan(0);
    expect(state.player.cash).toBeGreaterThan(0);
    expect(state.player.star).toBeGreaterThan(0);
  });

  it('돈다발 효과 중에는 점수가 두 배다', () => {
    const state = emptied();
    state.player.cash = 600;
    enemyAt(state, 'swarm', CENTER, px(400), 1);
    play(state, 60, () => ({ targetX: CENTER }));
    expect(state.score).toBe(20);
  });
});

describe('보스', () => {
  function toBossWave(seed = 3): OrangeState {
    const state = createState(seed);
    state.wave = WAVE_BOSS_EVERY - 1;
    state.queue = [];
    state.enemies = [];
    state.gates = [];
    state.waveTick = 0;
    state.waveLength = 0;
    play(state, 1, () => ({ targetX: CENTER }));
    return state;
  }

  it('10 웨이브마다 보스 웨이브가 되어 보스가 등장하고 덤벨을 던진다', () => {
    const state = toBossWave();
    expect(state.wave).toBe(WAVE_BOSS_EVERY);
    expect(state.bossActive).toBe(true);
    state.player.star = 99999;
    let maxShots = 0;
    let bossSeen = false;
    for (let i = 0; i < 600; i += 1) {
      step(state, { targetX: CENTER });
      maxShots = Math.max(maxShots, state.enemyShots.length);
      bossSeen = bossSeen || state.enemies.some((e) => e.kind === 'boss');
    }
    expect(bossSeen).toBe(true);
    expect(maxShots).toBeGreaterThan(0);
    const boss = state.enemies.find((e) => e.kind === 'boss');
    expect(boss && boss.y).toBeGreaterThan(0);
  });

  it('보스를 쓰러뜨리면 보너스·귤·게이트가 나오고 잠시 뒤 다음 웨이브가 시작된다', () => {
    const state = toBossWave();
    state.player.star = 999999;
    state.player.damage = 99;
    state.player.shots = 12;
    state.player.interval = 4;
    const events: string[] = [];
    for (let i = 0; i < 3000 && state.wave === WAVE_BOSS_EVERY; i += 1) {
      step(state, { targetX: state.enemies.find((e) => e.kind === 'boss')?.x ?? CENTER });
      state.events.forEach((e) => events.push(e.t));
    }
    expect(events).toContain('bossDown');
    expect(state.wave).toBe(WAVE_BOSS_EVERY + 1);
    expect(state.score).toBeGreaterThan(2000);
  });
});

describe('결정성과 정수', () => {
  const wiggle = (s: OrangeState): OrangeInput => ({ targetX: CENTER + ((s.tick >> 5) % 2 === 0 ? -px(90) : px(90)) });

  it('같은 시드와 같은 입력이면 결과가 같다', () => {
    const a = play(createState(42), FPS * 30, wiggle);
    const b = play(createState(42), FPS * 30, wiggle);
    expect(b).toEqual(a);
  });

  it('시드가 다르면 전개가 달라진다', () => {
    const a = play(createState(1), FPS * 10, wiggle);
    const b = play(createState(2), FPS * 10, wiggle);
    expect(JSON.stringify(a.queue)).not.toBe(JSON.stringify(b.queue));
  });

  it('긴 판을 돌려도 모든 좌표와 수치가 정수다(부동소수점이 없다)', () => {
    const state = createState(5);
    state.player.star = Number.MAX_SAFE_INTEGER;
    state.player.damage = 99;
    state.player.shots = 20;
    for (let i = 0; i < FPS * 120; i += 1) {
      step(state, wiggle(state));
      const numbers: number[] = [
        state.player.x, state.score, state.combo, ...state.bullets.flatMap((b) => [b.x, b.y, b.vx]),
        ...state.enemies.flatMap((e) => [e.x, e.y, e.hp, e.vy]), ...state.enemyShots.flatMap((s) => [s.x, s.y, s.vx]),
        ...state.gates.map((g) => g.y), ...state.items.flatMap((it) => [it.x, it.y]),
      ];
      const bad = numbers.find((n) => !Number.isInteger(n));
      expect(bad, `tick ${state.tick}`).toBeUndefined();
    }
    expect(PX).toBe(100);
  });
});
