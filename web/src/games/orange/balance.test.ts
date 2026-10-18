import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CASUAL, createBot, type BotOptions } from './bot';
import { FPS, createState, step } from './engine';

interface Run {
  wave: number;
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
  return { wave: state.wave, seconds: Math.round(state.tick / FPS), score: state.score, cause, peakPointsPerSecond: peak };
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const describeRuns = (runs: Run[]): string =>
  `wave 중앙값 ${median(runs.map((r) => r.wave))} (최소 ${Math.min(...runs.map((r) => r.wave))} / 최대 ${Math.max(...runs.map((r) => r.wave))}), ` +
  `시간 중앙값 ${median(runs.map((r) => r.seconds))}초, 최고 점수율 ${Math.round(Math.max(...runs.map((r) => r.peakPointsPerSecond)))}/초, ` +
  `사인 ${runs.map((r) => r.cause[0]).join('')}`;

describe('균형 점검(봇)', () => {
  it('숙련 봇 > 서툰 봇 > 가만히 있는 봇 순으로 멀리 간다', () => {
    const seeds = Array.from({ length: 16 }, (_, i) => i + 1);
    const maxTicks = FPS * 60 * 10;
    const skilled = seeds.map((s) => simulate(s, maxTicks, {}));
    const casual = seeds.map((s) => simulate(s, maxTicks, CASUAL));
    const idle = seeds.map((s) => simulate(s, maxTicks, null));
    appendFileSync(
      process.env.BALANCE_LOG ?? '/dev/null',
      `숙련: ${describeRuns(skilled)}\n서툰: ${describeRuns(casual)}\n가만: ${describeRuns(idle)}\n`,
    );
    expect(median(skilled.map((r) => r.wave))).toBeGreaterThan(median(casual.map((r) => r.wave)));
    expect(median(casual.map((r) => r.wave))).toBeGreaterThan(median(idle.map((r) => r.wave)));
  }, 300000);
});
