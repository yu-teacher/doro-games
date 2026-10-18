import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBot } from './bot';
import { FIELD, FPS, px, LANE_WIDTH, PLAYER, createState, enemySpeed, runSpeedFor, step, type OrangeInput, type OrangeState } from './engine';
import { HUMANS, createHuman, type HumanProfile } from './human';

interface Run {
  stage: number;
  seconds: number;
  cause: string;
  /** 보스가 나타나서 쓰러질 때까지 걸린 초(쓰러뜨린 보스만) */
  bossSeconds: number[];
  /** 마지막 보스전에서 죽었는가 */
  diedInBoss: boolean;
  peakPointsPerSecond: number;
}

function simulate(seed: number, maxTicks: number, driver: (state: OrangeState) => OrangeInput): Run {
  const state = createState(seed);
  let cause = 'time';
  let introAt = -1;
  const bossSeconds: number[] = [];
  const history: number[] = [];
  const window = FPS * 10;
  let peak = 0;
  for (let i = 0; i < maxTicks && !state.over; i += 1) {
    step(state, driver(state));
    for (const e of state.events) {
      if (e.t === 'bossIntro') {
        introAt = state.tick;
      } else if (e.t === 'bossDown' && introAt >= 0) {
        bossSeconds.push((state.tick - introAt) / FPS);
        introAt = -1;
      } else if (e.t === 'over') {
        cause = e.cause;
      }
    }
    history.push(state.score);
    if (history.length > window) {
      peak = Math.max(peak, (state.score - history[history.length - 1 - window]) / (window / FPS));
    }
  }
  return { stage: state.stage, seconds: Math.round(state.tick / FPS), cause, bossSeconds, diedInBoss: introAt >= 0 && state.over, peakPointsPerSecond: peak };
}

const median = (xs: number[]): number => (xs.length === 0 ? NaN : [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]);
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const MAX_TICKS = FPS * 60 * 12;

function runProfile(name: keyof typeof HUMANS | 'superhuman'): Run[] {
  return SEEDS.map((seed) => simulate(seed, MAX_TICKS, name === 'superhuman' ? createBot({ seed }) : createHuman(HUMANS[name as keyof typeof HUMANS] as HumanProfile, seed)));
}

function summary(name: string, runs: Run[]): string {
  const bosses = runs.flatMap((r) => r.bossSeconds);
  const stages = runs.map((r) => r.stage).sort((a, b) => a - b);
  return (
    `${name}: 스테이지 중앙값 ${median(stages)} (최소 ${stages[0]} / 최대 ${stages[stages.length - 1]}), 시간 중앙값 ${median(runs.map((r) => r.seconds))}초, ` +
    `보스 격파 ${bosses.length}회·전투 중앙값 ${bosses.length ? median(bosses).toFixed(1) : '-'}초(최단 ${bosses.length ? Math.min(...bosses).toFixed(1) : '-'}), ` +
    `보스전 사망 ${runs.filter((r) => r.diedInBoss).length}/${runs.length}, 최고 점수율 ${Math.round(Math.max(...runs.map((r) => r.peakPointsPerSecond)))}/초, ` +
    `사인 ${runs.map((r) => r.cause[0]).join('')}`
  );
}

const needed = (name: 'elite' | 'normal' | 'casual' | 'superhuman') => runProfile(name);

describe('사람 같은 봇으로 본 실제 난이도', () => {
  const results = {
    superhuman: needed('superhuman'),
    elite: needed('elite'),
    normal: needed('normal'),
    casual: needed('casual'),
  };

  it('프로필별 결과를 기록한다', () => {
    const log = process.env.BALANCE_LOG ?? '/dev/null';
    for (const [name, runs] of Object.entries(results)) {
      appendFileSync(log, `${summary(name, runs)}\n`);
    }
  });

  it('실력 순서대로 멀리 간다(숙련 ≥ 보통 ≥ 처음)', () => {
    const m = (name: keyof typeof results) => median(results[name].map((r) => r.stage));
    expect(m('elite')).toBeGreaterThanOrEqual(m('normal'));
    expect(m('normal')).toBeGreaterThanOrEqual(m('casual'));
    expect(m('superhuman')).toBeGreaterThanOrEqual(m('elite'));
  });

  it('처음 하는 사람도 첫 보스(10스테이지)까지는 대체로 가고, 숙련자도 무한 모드(100)에는 쉽게 닿지 않는다', () => {
    expect(median(results.casual.map((r) => r.stage))).toBeGreaterThanOrEqual(10);
    expect(median(results.elite.map((r) => r.stage))).toBeLessThan(100);
    expect(Math.max(...results.elite.map((r) => r.stage))).toBeGreaterThanOrEqual(30);
  });

  it('보스전은 너무 짧지 않다(사람 기준 중앙값 20초 이상, 너무 늘어지지도 않는다)', () => {
    for (const name of ['elite', 'normal', 'casual'] as const) {
      const seconds = results[name].flatMap((r) => r.bossSeconds);
      expect(seconds.length).toBeGreaterThan(5);
      expect(median(seconds)).toBeGreaterThanOrEqual(20);
      expect(median(seconds)).toBeLessThanOrEqual(60);
    }
  });

  it('보스전이 판 대부분을 끝내지는 않는다(보스전 사망이 전체의 3/4 미만)', () => {
    for (const name of ['elite', 'normal', 'casual'] as const) {
      expect(results[name].filter((r) => r.diedInBoss).length).toBeLessThan(15);
    }
  });

  it('초당 점수는 서버 상한(초당 3만 점)의 2/3 아래다', () => {
    for (const runs of Object.values(results)) {
      expect(Math.max(...runs.map((r) => r.peakPointsPerSecond))).toBeLessThan(20000);
    }
  });
});

describe('반응 여유: 빨라져도 사람이 피할 수 있다', () => {
  /** 사람이 위험을 알아보고 피하는 데 드는 시간(틱): 반응 300ms + 세 줄 옮기기 + 여유 10틱 */
  const REACTION_TICKS = Math.round(0.3 * FPS);
  const MOVE_TICKS = Math.ceil((3 * LANE_WIDTH) / PLAYER.speed);
  const NEEDED = REACTION_TICKS + MOVE_TICKS + 10;

  it('가장 빠른 적(달리는 적)이 화면 끝에서 나타나 닿기까지 걸리는 틱이 어느 스테이지에서도 충분하다', () => {
    for (const stage of [1, 10, 11, 50, 99, 100, 120, 150, 200, 300, 1000, 1_000_000]) {
      const closing = runSpeedFor(stage) + enemySpeed('runner', stage);
      const ticksOfSight = Math.floor(FIELD.depth / closing);
      expect(ticksOfSight, `stage ${stage}`).toBeGreaterThanOrEqual(NEEDED);
    }
  });

  it('보스가 던진 덤벨이 닿기까지의 시간도 충분하다', () => {
    const state = createState(3);
    state.queue = [];
    state.stage = 9;
    state.player.star = Number.MAX_SAFE_INTEGER;
    state.distance = state.stageStart + px(900);
    let flight = 0;
    for (let i = 0; i < 1200 && flight === 0; i += 1) {
      step(state, { targetX: state.player.x });
      const d = state.dumbbells[0];
      if (d) {
        flight = Math.floor(d.z / d.vz);
      }
    }
    expect(flight).toBeGreaterThanOrEqual(NEEDED);
  });

  it('저격수가 쏜 씨앗이 닿기까지의 시간도 충분하다', () => {
    const state = createState(3);
    state.stage = 31;
    state.queue = [{ at: 0, kind: 'sniper', x: px(180), hp: 50 }];
    state.stageStart = Number.MAX_SAFE_INTEGER / 2;
    state.player.star = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < 600 && !state.dumbbells.some((d) => d.style === 'seed'); i += 1) {
      step(state, { targetX: state.player.x });
    }
    const seed = state.dumbbells.find((d) => d.style === 'seed');
    expect(seed).toBeDefined();
    expect(Math.floor((seed?.z ?? 0) / (seed?.vz ?? 1))).toBeGreaterThanOrEqual(NEEDED);
  });
});
