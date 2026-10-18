import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CASUAL, createBot, type BotOptions } from './bot';
import { FPS, createState, step } from './engine';

interface Run {
  stage: number;
  seconds: number;
  score: number;
  cause: string;
  peakPointsPerSecond: number;
}

/** 한 판을 끝까지(또는 상한까지) 돌린다. 10초 창에서 초당 점수의 최고치도 잰다. */
function simulate(seed: number, maxTicks: number, options: BotOptions | null): Run {
  const state = createState(seed);
  const bot = options ? createBot({ ...options, seed }) : null;
  let cause = 'time';
  const window = FPS * 10;
  const history: number[] = [];
  let peak = 0;
  for (let i = 0; i < maxTicks && !state.over; i += 1) {
    step(state, bot ? bot(state) : { targetX: 18000 });
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
  return { stage: state.stage, seconds: Math.round(state.tick / FPS), score: state.score, cause, peakPointsPerSecond: peak };
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const describeRuns = (runs: Run[]): string =>
  `스테이지 중앙값 ${median(runs.map((r) => r.stage))} (최소 ${Math.min(...runs.map((r) => r.stage))} / 최대 ${Math.max(...runs.map((r) => r.stage))}), ` +
  `시간 중앙값 ${median(runs.map((r) => r.seconds))}초, 최고 점수율 ${Math.round(Math.max(...runs.map((r) => r.peakPointsPerSecond)))}/초, ` +
  `사인 ${runs.map((r) => r.cause[0]).join('')}`;

describe('균형 점검(봇)', () => {
  it('가만히 서 있는 것보다 움직이는 봇이 멀리 가고, 어느 쪽도 끝없이 가지는 못한다', () => {
    const seeds = Array.from({ length: 16 }, (_, i) => i + 1);
    const maxTicks = FPS * 60 * 10;
    const skilled = seeds.map((s) => simulate(s, maxTicks, {}));
    const casual = seeds.map((s) => simulate(s, maxTicks, CASUAL));
    const idle = seeds.map((s) => simulate(s, maxTicks, null));
    appendFileSync(
      process.env.BALANCE_LOG ?? '/dev/null',
      `숙련: ${describeRuns(skilled)}\n서툰: ${describeRuns(casual)}\n가만: ${describeRuns(idle)}\n`,
    );
    expect(median(skilled.map((r) => r.stage))).toBeGreaterThan(median(idle.map((r) => r.stage)));
    expect(median(casual.map((r) => r.stage))).toBeGreaterThan(median(idle.map((r) => r.stage)));
    // 지수로 커지는 체력 때문에 10분(상한) 안에 모두 끝난다
    [...skilled, ...casual, ...idle].forEach((r) => expect(r.cause).not.toBe('time'));
  }, 300000);
});
