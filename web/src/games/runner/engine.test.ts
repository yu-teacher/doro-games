import { describe, expect, it } from 'vitest';
import { FPS, SCORE_PER_PIXEL, createState, nextRandom, scoreOf, step, type RunnerInput, type RunnerState } from './engine';

const IDLE: RunnerInput = { jump: false, duck: false };
const JUMP: RunnerInput = { jump: true, duck: false };
const DUCK: RunnerInput = { jump: false, duck: true };

function run(state: RunnerState, frames: number, input: (tick: number) => RunnerInput): RunnerState {
  for (let i = 0; i < frames && !state.over; i += 1) {
    step(state, input(state.tick));
  }
  return state;
}

/** 규칙대로 장애물을 피하는 단순한 봇: 가까운 콘은 점프, 낮은 드론은 숙임 */
function bot(state: RunnerState): RunnerInput {
  const next = state.obstacles.find((o) => o.x + o.width > 40);
  if (!next) {
    return IDLE;
  }
  const distance = next.x - 72;
  if (next.kind === 'cone' && distance < 90 && distance > 0) {
    return JUMP;
  }
  if (next.kind === 'drone' && next.bottom < 40 && distance < 140) {
    return DUCK;
  }
  return IDLE;
}

describe('난수 생성기', () => {
  it('같은 시드면 같은 수열이고 0 이상 1 미만이다', () => {
    let a = 123;
    let b = 123;
    for (let i = 0; i < 50; i += 1) {
      const x = nextRandom(a);
      const y = nextRandom(b);
      a = x.next;
      b = y.next;
      expect(x.value).toBe(y.value);
      expect(x.value).toBeGreaterThanOrEqual(0);
      expect(x.value).toBeLessThan(1);
    }
  });
});

describe('점프와 숙이기', () => {
  it('점프하면 올라갔다가 반드시 땅으로 돌아온다', () => {
    const state = createState(1);
    step(state, JUMP);
    expect(state.playerBottom).toBeGreaterThan(0);
    let peak = 0;
    for (let i = 0; i < FPS; i += 1) {
      step(state, IDLE);
      peak = Math.max(peak, state.playerBottom);
    }
    expect(peak).toBeGreaterThan(60);
    expect(state.playerBottom).toBe(0);
    expect(state.velocityY).toBe(0);
  });

  it('공중에서는 다시 점프할 수 없다', () => {
    const state = createState(1);
    step(state, JUMP);
    const velocityAfterFirst = state.velocityY;
    step(state, JUMP);
    expect(state.velocityY).toBeLessThan(velocityAfterFirst);
  });

  it('공중에서 숙이면 더 빨리 내려온다', () => {
    const slow = createState(1);
    const fast = createState(1);
    step(slow, JUMP);
    step(fast, JUMP);
    for (let i = 0; i < 20; i += 1) {
      step(slow, IDLE);
      step(fast, DUCK);
    }
    expect(fast.playerBottom).toBeLessThan(slow.playerBottom);
  });
});

describe('진행과 점수', () => {
  it('속도는 점점 빨라지지만 최고 속도를 넘지 않는다', () => {
    const state = createState(7);
    const initial = state.speed;
    run(state, 3000, () => bot(state));
    expect(state.speed).toBeGreaterThan(initial);
    expect(state.speed).toBeLessThanOrEqual(13);
  });

  it('점수는 달린 거리에 비례하고 서버가 허용하는 초당 최대 점수(25)보다 낮다', () => {
    const state = createState(7);
    run(state, FPS * 60, () => bot(state));
    const seconds = state.tick / FPS;
    expect(scoreOf(state)).toBe(Math.floor(state.distance * SCORE_PER_PIXEL));
    expect(scoreOf(state) / seconds).toBeLessThan(25);
  });

  it('아무것도 하지 않으면 결국 장애물에 부딪혀 끝난다', () => {
    const state = createState(3);
    run(state, FPS * 60, () => IDLE);
    expect(state.over).toBe(true);
  });

  it('끝난 판은 더 진행하지 않는다', () => {
    const state = createState(3);
    run(state, FPS * 60, () => IDLE);
    const tick = state.tick;
    const distance = state.distance;
    step(state, JUMP);
    expect(state.tick).toBe(tick);
    expect(state.distance).toBe(distance);
  });

  it('같은 시드와 같은 입력이면 결과가 같다(결정적)', () => {
    const a = run(createState(99), 2000, (tick) => (tick % 70 < 3 ? JUMP : IDLE));
    const b = run(createState(99), 2000, (tick) => (tick % 70 < 3 ? JUMP : IDLE));
    expect(b).toEqual(a);
  });

  it('시드가 다르면 장애물 배치가 달라진다', () => {
    const a = run(createState(1), 600, () => IDLE);
    const b = run(createState(2), 600, () => IDLE);
    expect(a.gapRemaining === b.gapRemaining && a.tick === b.tick).toBe(false);
  });
});

describe('드론', () => {
  it('점수가 낮은 동안에는 콘만 나온다', () => {
    const state = createState(5);
    const kinds = new Set<string>();
    for (let i = 0; i < FPS * 15 && !state.over && scoreOf(state) < 150; i += 1) {
      step(state, bot(state));
      state.obstacles.forEach((o) => kinds.add(o.kind));
    }
    expect([...kinds]).toEqual(['cone']);
  });
});
