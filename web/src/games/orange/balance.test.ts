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
  it('움직이는 봇이 가만히 서 있는 것보다 못하지 않게 간다', () => {
    const seeds = Array.from({ length: 16 }, (_, i) => i + 1);
    const maxTicks = FPS * 60 * 10;
    const skilled = seeds.map((s) => simulate(s, maxTicks, {}));
    const casual = seeds.map((s) => simulate(s, maxTicks, CASUAL));
    const idle = seeds.map((s) => simulate(s, maxTicks, null));
    const worst = seeds.map((s) => simulate(s, maxTicks, { gatePolicy: 'worst' }));
    appendFileSync(
      process.env.BALANCE_LOG ?? '/dev/null',
      `숙련: ${describeRuns(skilled)}\n서툰: ${describeRuns(casual)}\n가만: ${describeRuns(idle)}\n나쁜 선택만: ${describeRuns(worst)}\n`,
    );
    expect(median(skilled.map((r) => r.stage))).toBeGreaterThanOrEqual(median(idle.map((r) => r.stage)));
    expect(median(casual.map((r) => r.stage))).toBeGreaterThanOrEqual(median(idle.map((r) => r.stage)));

    // 게이트 선택에 결과가 있다: 일부러 나쁜 칸만 고르면 이로운 칸을 고르는 것보다 훨씬 일찍 끝난다
    expect(median(skilled.map((r) => r.stage))).toBeGreaterThan(median(worst.map((r) => r.stage)) * 2);
    // 스테이지 100 에서 성장이 멈추므로 잘하는 판은 끝없이 이어질 수 있다(10분 상한에 닿는 판이 있어도 오류가 아니다)
  }, 300000);
});
