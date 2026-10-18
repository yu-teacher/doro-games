import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { botInput } from './bot';
import { FPS, createState, step, type OrangeState } from './engine';

interface Run {
  wave: number;
  ticks: number;
  score: number;
  cause: string;
  peakPointsPerSecond: number;
}

/** 한 판을 끝까지(또는 상한까지) 돌린다. 10초 창에서 초당 점수의 최고치도 잰다. */
function simulate(seed: number, maxTicks: number, play: (s: OrangeState) => { targetX: number }): Run {
  const state = createState(seed);
  let cause = 'time';
  const window = FPS * 10;
  const history: number[] = [];
  let peak = 0;
  for (let i = 0; i < maxTicks && !state.over; i += 1) {
    step(state, play(state));
    for (const e of state.events) {
      if (e.t === 'over') {
        cause = e.cause;
      }
    }
    history.push(state.score);
    if (history.length > window) {
      peak = Math.max(peak, (state.score - history[history.length - 1 - window]) / (window / FPS));
    }
  }
  return { wave: state.wave, ticks: state.tick, score: state.score, cause, peakPointsPerSecond: peak };
}

describe('균형 점검(봇)', () => {
  it('잘 하는 봇은 꽤 멀리 가고, 가만히 있는 봇은 일찍 끝난다', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const skilled = seeds.map((s) => simulate(s, FPS * 60 * 10, (st) => botInput(st)));
    const idle = seeds.map((s) => simulate(s, FPS * 60 * 10, () => ({ targetX: 18000 })));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    appendFileSync(process.env.BALANCE_LOG ?? '/dev/null', [
      'skilled',
      skilled.map((r) => `${r.wave}w/${Math.round(r.ticks / FPS)}s/${r.score}pt/${r.cause}/pk${Math.round(r.peakPointsPerSecond)}`).join(' | '),
      '\nidle   ',
      idle.map((r) => `${r.wave}w/${Math.round(r.ticks / FPS)}s/${r.score}pt/${r.cause}`).join(' | '),
      '\n',
    ].join(' '));
    expect(avg(skilled.map((r) => r.wave))).toBeGreaterThan(avg(idle.map((r) => r.wave)) + 2);
  }, 120000);
});
