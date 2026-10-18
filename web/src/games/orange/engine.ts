/**
 * 「귤 폭격 도로롱」의 게임 규칙(러너 시점). 화면과 분리된 순수 로직이다.
 *
 * - 도로롱은 도로를 따라 앞으로 달리고(자동), 좌우로만 움직이며 앞으로 귤 탄을 쏜다(자동).
 * - 세계는 가로 x 와 깊이 z 로 나뉜다. z=0 이 도로롱이 서 있는 곳이고, 멀수록 z 가 크다. 모든 것이 z 가 줄어드는 쪽(도로롱 쪽)으로 다가온다.
 *   원근(멀수록 작게)은 그리는 쪽이 계산한다. 엔진에는 없다.
 * - **정수만 쓴다.** 좌표는 1px = PX(100) 단위의 정수이고 나눗셈은 내림이다. 부동소수점이 없어서 같은 시드와 같은 입력이면
 *   어디서 돌려도(브라우저, 서버의 재생 검증) 똑같은 결과가 나온다.
 * - 한 번의 {@link step} 은 정확히 한 프레임(1/60 초)이다.
 * - 한 방 컷: 부딪히거나 덤벨에 맞으면 끝이다. 귤(보호막)이 있으면 한 번은 막는다.
 * - 화면 효과는 여기서 정하지 않는다. 엔진은 {@link GameEvent} 만 내보낸다.
 */

export const FPS = 60;
export const STEP_MS = 1000 / FPS;

/** 1px 을 나타내는 정수 단위(서브픽셀). */
export const PX = 100;
export const px = (n: number): number => Math.round(n * PX);

export const FIELD = { width: px(360), depth: px(1100) } as const;

/** 도로는 5줄이다. 게이트의 칸, 귤 덩어리와 적의 자리가 줄 단위로 정해진다. */
export const LANE_COUNT = 5;
export const LANE_WIDTH = FIELD.width / LANE_COUNT;
export function laneCenter(lane: number): number {
  return lane * LANE_WIDTH + LANE_WIDTH / 2;
}

/** 이 스테이지부터는 무한 모드: 더 강해질 수 없는 대신 적이 계속 어려워진다(적 도전 배율·몰려오는 속도·개수가 끝없이 오른다). */
export const INFINITE_FROM_STAGE = 100;

export const PLAYER = {
  width: px(34),
  /** 맞았는지 따질 때는 눈에 보이는 몸보다 좁게 쓴다 */
  hitWidth: px(22),
  pickupWidth: px(30),
  /** 부딪힘을 따질 때 도로롱이 차지하는 깊이(앞뒤 두께) */
  depth: px(20),
  speed: px(8),
  startShots: 3,
  startInterval: 12,
  startDamage: 3,
  /** 어떤 스테이지에서도 넘지 못하는 절대 한계(총알 수는 화면이 감당할 수 있는 만큼, 연사는 이보다 빠를 수 없다) */
  maxShots: 16,
  minInterval: 5,
  /** 연사가 느려지는 함정으로도 이 이상은 느려지지 않는다 */
  slowestInterval: 24,
  maxShield: 2,
  invulnTicksAfterShield: 60,
} as const;

const BULLET = { width: px(6), depth: px(10), speed: px(11), fanStep: 28, maxSpan: px(110), spacing: px(7), pierceHits: 2 } as const;

const RUN = { base: px(1.6), perStage: px(0.04), maxBonus: px(1.0), infinitePerLevel: px(0.01), infiniteMax: px(1.2) } as const;

const STAGE = {
  length: px(900),
  bossEvery: 10,
  afterBoss: 150,
} as const;

const GATE = {
  depth: px(24),
  /** 총알을 이 횟수만큼 맞을 때마다 + 계열 값이 1 오른다(총알 수는 빨리, 공격력·연사는 느리게) */
  hitsPerStepShots: 30,
  hitsPerStepOther: 40,
  /** 쏴서 키울 수 있는 최대 증가량(원래 값 기준). 접근하는 내내 겨눠서 쏴야 닿는 정도 */
  maxGain: 3,
} as const;

const ITEM = { width: px(26), dropBoulder: 30, dropBrute: 25, dropGrunt: 3 } as const;
const ITEM_WEIGHTS = { orange: 30, chicken: 18, cash: 12, star: 10, pierce: 15, bomb: 15 } as const;
const POWER = { chickenTicks: 360, cashTicks: 480, starTicks: 300, pierceTicks: 600 } as const;
const BOMB = { base: 60, perVolley: 15, range: px(450), bossPercent: 40 } as const;

const COMBO = { window: 90, perStep: 10, maxMultiplier: 5 } as const;

/** 종류별 크기·속도·점수. 체력은 지금 내 실제 화력(baseFirepower)에서 정한다. */
const ENEMY = {
  grunt: { w: px(24), depth: px(16), speed: px(0.7), points: 10 },
  brute: { w: px(38), depth: px(22), speed: px(0.4), points: 50 },
  boulder: { w: px(110), depth: px(46), speed: 0, points: 100 },
  boss: { w: px(150), depth: px(60), speed: px(1.2), points: 2000 },
} as const;

/**
 * 적의 체력은 "지금 내 실제 화력" 에서 정한다(곡선으로 미리 정하지 않는다). 내 화력이 자라는 만큼 부술 맛이 계속 이어지고,
 * 난이도는 도전 배율(challengePercent)과 크기·속도·개수로 올린다. 도전 배율 100% 는 "접근하는 내내 계속 쏘면 겨우 부수는" 정도이고, 실제로는 다른 일도 해야 해서 55% 면 부술 수 있는 것이 70% 안팎, 비켜 가야 하는 것이 나머지가 된다.
 */
const CHALLENGE = { startPercent: 40, perStage: 1, maxPercent: 55 } as const;
/**
 * 실제로 줄 수 있는 피해는 이론치(화력 × 접근 시간)보다 훨씬 적다: 총알이 부채꼴로 퍼져 일부는 빗나가고, 다른 적도 쏘고 피해야 한다.
 * 그래서 귤 덩어리·무리·덩치의 체력에는 이 적중 계수를 곱한다(실제로 봇이 부순 비율로 맞춘 값).
 */
const HIT_EFFICIENCY_PERCENT = 32;
/** 적 체력의 기준: "이 스테이지의 한계 화력" 의 이 비율(%). 한계의 이만큼을 가진 사람이 도전 배율대로 부술 수 있도록 맞춘다. */
const ANCHOR_PERCENT = 40;
/** 무한 모드: 스테이지가 하나 오를 때마다(레벨) 늘어나는 양. 레벨에는 상한이 있어 모든 수치가 안전한 정수 안에 머문다. */
const INFINITE = { levelCap: 300, challengePerLevel: 3, bossPercentPerLevel: 4, crowdSpeedPerLevel: px(0.05), crowdSpeedMax: px(3.5), extraCrowdCap: 40 } as const;

const BOSS = {
  holdZ: px(340),
  moveSpeed: px(1.5),
  throwEvery: 80,
  throwEveryPhase2: 50,
  dumbbellSpeed: px(4.4),
  dumbbellWidth: px(24),
  shieldEvery: 480,
  shieldTicks: 120,
  killBonus: 1000,
  seconds: 10,
  growthPercent: 8,
} as const;

export const STAGE_BOSS_EVERY = STAGE.bossEvery;

export type EnemyKind = keyof typeof ENEMY;
export type ItemKind = keyof typeof ITEM_WEIGHTS;

/** 게이트가 하는 일. + 와 × 는 총알 수, rate 는 연사, dmg 는 공격력. 마이너스 쪽(shotsDown, shotsHalf)은 함정이다. */
export type GateKind = 'shotsUp' | 'shotsMul' | 'rateUp' | 'dmgUp' | 'shotsDown' | 'shotsHalf' | 'dmgDown' | 'rateDown';

export interface GateEffect {
  kind: GateKind;
  value: number;
  /** 게이트가 만들어졌을 때의 값(키울 수 있는 한도를 정하는 기준) */
  start: number;
  /** 지금까지 맞은 총알 수 */
  hits: number;
}

/** 게이트의 한 칸. 줄 단위로 나뉘며(좋은 칸은 좁고 나쁜 칸은 넓다), hidden 이면 들어가기 전까지 효과를 알 수 없다. */
export interface GateZone {
  x0: number;
  x1: number;
  effect: GateEffect;
  hidden: boolean;
}

export interface Gate {
  id: number;
  z: number;
  zones: GateZone[];
  /** 안쪽 경계가 좌우로 흔들리는 폭(0 이면 고정). 칸의 위치를 미리 믿고 달려가면 안 된다. */
  sway: number;
  used: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  w: number;
  depth: number;
  hp: number;
  maxHp: number;
  /** 도로롱 쪽으로 스스로 다가오는 속도(세계가 다가오는 속도에 더해진다) */
  speed: number;
  /** 맞았을 때 하얗게 번쩍이는 남은 틱(그리기용) */
  flash: number;
  /** 보스가 막고 있는 남은 틱 */
  shielded: number;
  born: number;
  /** 기울어져 보이는 정도(그리기용 고정값) */
  seed: number;
}

export interface Bullet {
  id: number;
  x: number;
  z: number;
  vx: number;
  damage: number;
  /** 더 뚫을 수 있는 적의 수 */
  pierce: number;
  /** 마지막으로 값을 키워 준 게이트와 마지막으로 때린 적(같은 대상을 두 번 세지 않으려고) */
  gateId: number;
  lastHit: number;
}

export interface Dumbbell {
  id: number;
  x: number;
  z: number;
  vx: number;
}

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  z: number;
}

export interface Player {
  x: number;
  targetX: number;
  shots: number;
  interval: number;
  damage: number;
  cooldown: number;
  shield: number;
  invuln: number;
  chicken: number;
  cash: number;
  star: number;
  pierce: number;
}

interface Spawn {
  at: number;
  kind: EnemyKind | 'gate' | 'item' | 'crowd';
  x: number;
  hp?: number;
  w?: number;
  count?: number;
  item?: ItemKind;
  gate?: { zones: GateZone[]; sway: number };
}

export type GameEvent =
  | { t: 'kill'; kind: EnemyKind; x: number; z: number; points: number }
  | { t: 'gate'; kind: GateKind; value: number; x: number }
  | { t: 'item'; kind: ItemKind; x: number }
  | { t: 'bomb'; x: number }
  | { t: 'shieldBreak'; x: number }
  | { t: 'stage'; n: number }
  | { t: 'infinite' }
  | { t: 'bossIntro' }
  | { t: 'bossShield'; on: boolean }
  | { t: 'bossDown'; x: number; z: number }
  | { t: 'over'; cause: 'touch' | 'shot' };

export interface OrangeState {
  tick: number;
  rng: number;
  nextId: number;
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  dumbbells: Dumbbell[];
  gates: Gate[];
  items: Item[];
  stage: number;
  /** 지금 스테이지가 시작된 거리와 지금까지 달린 거리(스폰 시점을 정한다. 보스와 싸우는 동안은 늘지 않는다) */
  stageStart: number;
  distance: number;
  /** 도로가 뒤로 흘러간 총 거리(그리기용: 차선이 움직인다) */
  scroll: number;
  queue: Spawn[];
  bossActive: boolean;
  afterBossTimer: number;
  score: number;
  kills: number;
  combo: number;
  comboTimer: number;
  over: boolean;
  events: GameEvent[];
}

export interface OrangeInput {
  /** 가고 싶은 x 좌표(PX 단위). 캐릭터는 최대 속도로 이 쪽으로 움직인다. */
  targetX: number;
}

// ---------------------------------------------------------------------------------------------- 난수

/** mulberry32: 상태 하나(32비트 정수)로 이어서 뽑는 난수 생성기. 부호 없는 정수를 돌려준다. */
export function nextUint(seed: number): { value: number; next: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: (t ^ (t >>> 14)) >>> 0, next };
}

/** 0 이상 n 미만의 정수 */
function rand(state: OrangeState, n: number): number {
  const { value, next } = nextUint(state.rng);
  state.rng = next;
  return value % n;
}

// ---------------------------------------------------------------------------------------------- 수치

/** 무한 모드에서 몇 스테이지나 더 갔는지(0 이면 아직 무한 모드가 아니다). 상한이 있어 수치가 커지다 멈춘다. */
export function infiniteLevel(stage: number): number {
  return Math.min(INFINITE.levelCap, Math.max(0, stage - INFINITE_FROM_STAGE + 1));
}

export function isInfinite(stage: number): boolean {
  return stage >= INFINITE_FROM_STAGE;
}

/** 스테이지에 따른 도전 배율(%). 일반 구간에서는 완만하게 오르다 멈추고, 무한 모드에서는 스테이지마다 계속 오른다. */
export function challengePercent(stage: number): number {
  const base = Math.min(CHALLENGE.maxPercent, CHALLENGE.startPercent + Math.floor(Math.max(0, stage) * CHALLENGE.perStage));
  return base + infiniteLevel(stage) * INFINITE.challengePerLevel;
}

/** 적 체력의 기준 화력: 이 스테이지의 한계 화력의 일부. 내 현재 화력이 아니라 한계에 묶어서, 게이트·아이템을 잘 골라 한계에 가까워져야 부술 수 있다. */
export function anchorFirepower(stage: number): number {
  return Math.max(1, Math.floor((firepowerCap(stage) * ANCHOR_PERCENT) / 100));
}

/** 무한 모드에서 몰려오는 적이 더 빨라지는 양(스테이지가 오를수록 점점). */
export function crowdSpeedBonus(stage: number): number {
  return Math.min(INFINITE.crowdSpeedMax, infiniteLevel(stage) * INFINITE.crowdSpeedPerLevel);
}

/** 치킨 같은 일시 효과를 뺀 도로롱의 초당 피해량. 적의 체력의 기준이 된다. */
export function baseFirepower(player: Player): number {
  return Math.max(1, Math.floor((player.shots * player.damage * FPS) / player.interval));
}

// ----- 스테이지별 상한: 상한 자체가 스테이지와 함께 올라가서 성장이 끝나지 않는다 -----
const CAP = { shotsStart: 4, shotsEveryStages: 2, intervalStart: 12, intervalEveryStages: 3, damageStart: 6, damageGrowthPercent: 113 } as const;

/**
 * 상한이 스테이지와 함께 자라는 것은 이 스테이지까지만이다. 더 가면 값이 멈춘다.
 * 이유: 서버가 같은 결과를 재현해야 해서 모든 수치를 JS 가 정확히 다루는 정수(2^53 ≈ 9.0×10^15)에 담아야 하는데,
 * 지수로 계속 키우면 아주 오래 사는 판에서 곱셈 중간값이 그 한계를 넘는다. 이 스테이지에서 멈추면 가장 큰 곱(체력 계산)도 한계의 1/300 안팎에 머문다.
 */
export const SCALING_STAGE_LIMIT = 100;

const damageCapCache: number[] = [CAP.damageStart];

/** 이 스테이지에서 낼 수 있는 최대 총알 수 */
export function shotsCap(stage: number): number {
  return Math.min(PLAYER.maxShots, CAP.shotsStart + Math.floor(Math.min(SCALING_STAGE_LIMIT, Math.max(0, stage)) / CAP.shotsEveryStages));
}

/** 이 스테이지에서 가장 빠를 수 있는 연사 간격(작을수록 빠르다) */
export function intervalFloor(stage: number): number {
  return Math.max(PLAYER.minInterval, CAP.intervalStart - Math.floor(Math.min(SCALING_STAGE_LIMIT, Math.max(0, stage)) / CAP.intervalEveryStages));
}

/** 이 스테이지에서 낼 수 있는 최대 공격력. 처음엔 한 스테이지에 1씩 늘다가 곧 13% 씩 지수로 커진다(정수 연산). */
export function damageCap(stage: number): number {
  const n = Math.min(SCALING_STAGE_LIMIT, Math.max(1, stage)) - 1;
  while (damageCapCache.length <= n) {
    const last = damageCapCache[damageCapCache.length - 1];
    damageCapCache.push(Math.max(last + 1, Math.floor((last * CAP.damageGrowthPercent) / 100)));
  }
  return damageCapCache[n];
}

/** 이 스테이지에서 낼 수 있는 최대 화력(초당 피해량). 화면에 "한계" 로 보여 준다. */
export function firepowerCap(stage: number): number {
  return Math.floor((shotsCap(stage) * damageCap(stage) * FPS) / intervalFloor(stage));
}

/** 지금 도로롱의 초당 피해량(화면에 보이는 "화력" 숫자). */
export function firepower(player: Player): number {
  const interval = player.chicken > 0 ? Math.max(PLAYER.minInterval, Math.floor(player.interval / 2)) : player.interval;
  return Math.floor((player.shots * player.damage * FPS) / interval);
}

export function runSpeedFor(stage: number): number {
  return RUN.base + Math.min(RUN.maxBonus, (stage - 1) * RUN.perStage) + Math.min(RUN.infiniteMax, infiniteLevel(stage) * RUN.infinitePerLevel);
}

export function comboMultiplier(combo: number): number {
  return Math.min(COMBO.maxMultiplier, 1 + Math.floor(combo / COMBO.perStep));
}

// ---------------------------------------------------------------------------------------------- 생성

function takeId(state: OrangeState): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

export function createState(seed: number): OrangeState {
  const state: OrangeState = {
    tick: 0,
    rng: seed >>> 0,
    nextId: 1,
    player: {
      x: FIELD.width / 2,
      targetX: FIELD.width / 2,
      shots: PLAYER.startShots,
      interval: PLAYER.startInterval,
      damage: PLAYER.startDamage,
      cooldown: 0,
      shield: 0,
      invuln: 0,
      chicken: 0,
      cash: 0,
      star: 0,
      pierce: 0,
    },
    bullets: [],
    enemies: [],
    dumbbells: [],
    gates: [],
    items: [],
    stage: 0,
    stageStart: 0,
    distance: 0,
    scroll: 0,
    queue: [],
    bossActive: false,
    afterBossTimer: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    over: false,
    events: [],
  };
  startStage(state);
  return state;
}

export function effect(kind: GateKind, value: number): GateEffect {
  return { kind, value, start: value, hits: 0 };
}

function goodGate(state: OrangeState, stage: number): GateEffect {
  const p = state.player;
  const roll = rand(state, 100);
  // 공격력 게이트는 지금 값의 25%(최소 +2). 숫자가 커져도 한 번의 성장이 의미 있게 유지된다.
  const damage = effect('dmgUp', Math.max(2, Math.floor((p.damage * 25) / 100)));
  // 이 스테이지의 상한에 이미 닿은 스탯의 게이트는 쓸모없으니 공격력 게이트로 바꾼다(성장이 멈추지 않게)
  if (roll < 36) {
    return p.shots >= shotsCap(stage) ? damage : effect('shotsUp', 1 + Math.floor(stage / 8));
  }
  if (roll < 50 && stage >= 10) {
    return p.shots >= shotsCap(stage) ? damage : effect('shotsMul', 2);
  }
  if (roll < 74) {
    return p.interval <= intervalFloor(stage) ? damage : effect('rateUp', 2);
  }
  return damage;
}

/** 나쁜 쪽(−) 게이트: 총알 수 감소, 공격력 감소, 연사 느려짐, (후반) 총알 수 절반. */
function badGate(state: OrangeState, stage: number): GateEffect {
  const roll = rand(state, 100);
  if (roll < 30) {
    return effect('shotsDown', 1 + Math.floor(stage / 10));
  }
  if (roll < 55) {
    return effect('dmgDown', 20 + Math.min(30, Math.floor(stage / 3)));
  }
  if (roll < 80) {
    return effect('rateDown', 2);
  }
  return stage >= 12 ? effect('shotsHalf', 2) : effect('shotsDown', 1 + Math.floor(stage / 10));
}

/** 5줄을 가로로 이어진 칸들로 나누는 방법(줄 수의 묶음). 칸이 많을수록 좋은 칸이 좁아져 고르기 어렵다. */
const GATE_LAYOUTS = {
  // 좋은 칸이 1줄인 배치를 더 자주(같은 배치를 두 번 넣어 가중치를 줬다)
  pair: [[1, 4], [1, 4], [4, 1], [4, 1], [2, 3], [3, 2]],
  triple: [[1, 1, 3], [1, 3, 1], [3, 1, 1], [2, 1, 2], [1, 2, 2], [2, 2, 1]],
  five: [[1, 1, 1, 1, 1]],
} as const;

const SWAY = { minWidth: px(30), extraWidth: px(30), period: 240, fromStage: 15, percent: 30 } as const;
const MYSTERY = { fromStage: 8, percent: 20, goodPercent: 65 } as const;
const TRIPLE_FROM_STAGE = 12;
const FIVE_FROM_STAGE = 25;

/**
 * 게이트 한 줄. 좋은 칸(+)은 1~2줄로 좁고 나쁜 칸(−)은 3~4줄로 넓다. 후반에는 3분할·5분할, 흔들리는 경계, 가려진 칸(?)이 섞인다.
 * 이로운 칸은 언제나 정확히 하나 있다(가려진 칸이 이롭다고 보장되지는 않는다).
 */
function planGate(state: OrangeState, stage: number): { zones: GateZone[]; sway: number } {
  const layoutRoll = rand(state, 100);
  const options = stage >= FIVE_FROM_STAGE && layoutRoll < 25 ? GATE_LAYOUTS.five : stage >= TRIPLE_FROM_STAGE && layoutRoll < 60 ? GATE_LAYOUTS.triple : GATE_LAYOUTS.pair;
  const sizes = options[rand(state, options.length)] as readonly number[];

  const narrow = sizes.map((size, i) => (size <= 2 ? i : -1)).filter((i) => i >= 0);
  const goodIndex = narrow[rand(state, narrow.length)];
  const effects = sizes.map((_, i) => {
    if (i === goodIndex) {
      return goodGate(state, stage);
    }
    // 초반에는 둘 다 쓸 만하게, 갈수록 나머지 칸은 거의 다 나쁜 칸이다
    const goodChance = stage <= 2 ? 100 : stage < 6 ? 40 : 10;
    return rand(state, 100) < goodChance ? goodGate(state, stage) : badGate(state, stage);
  });

  const hidden = sizes.map(() => false);
  if (stage >= MYSTERY.fromStage && rand(state, 100) < MYSTERY.percent) {
    const index = rand(state, sizes.length);
    hidden[index] = true;
    effects[index] = rand(state, 100) < MYSTERY.goodPercent ? goodGate(state, stage) : badGate(state, stage);
  }

  let lane = 0;
  const zones: GateZone[] = sizes.map((size, i) => {
    const zone: GateZone = { x0: lane * LANE_WIDTH, x1: (lane + size) * LANE_WIDTH, effect: effects[i], hidden: hidden[i] };
    lane += size;
    return zone;
  });
  const sway = stage >= SWAY.fromStage && sizes.length > 1 && rand(state, 100) < SWAY.percent ? SWAY.minWidth + rand(state, SWAY.extraWidth) : 0;
  return { zones, sway };
}

/** 흔들리는 게이트의 지금 경계 이동량(안쪽 경계가 모두 같이 움직인다). */
export function gateSwayOffset(gate: Gate, tick: number): number {
  if (gate.sway === 0) {
    return 0;
  }
  const phase = (tick + gate.id * 37) % SWAY.period;
  const triangle = phase < SWAY.period / 2 ? phase : SWAY.period - phase;
  return Math.trunc(((triangle - SWAY.period / 4) * gate.sway) / (SWAY.period / 4));
}

/** 지금 이 순간의 각 칸의 가로 범위(흔들림 반영). 맨 바깥 경계(도로 양 끝)는 움직이지 않는다. */
export function gateBounds(gate: Gate, tick: number): { x0: number; x1: number }[] {
  const offset = gateSwayOffset(gate, tick);
  const last = gate.zones.length - 1;
  return gate.zones.map((zone, i) => ({ x0: i === 0 ? zone.x0 : zone.x0 + offset, x1: i === last ? zone.x1 : zone.x1 + offset }));
}

/** x 위치가 속한 칸. */
export function gateZoneAt(gate: Gate, tick: number, x: number): GateZone {
  const bounds = gateBounds(gate, tick);
  const index = bounds.findIndex((b) => x < b.x1);
  return gate.zones[index < 0 ? gate.zones.length - 1 : index];
}

/** 한 줄(band)에서 귤 덩어리가 막는 줄과, 반드시 비워 두는 통로 줄(연속 2줄). */
function boulderBand(state: OrangeState, stage: number, at: number, hpFor: () => number): Spawn[] {
  const corridorStart = rand(state, LANE_COUNT - 1);
  const regions: [number, number][] = [];
  if (corridorStart > 0) {
    regions.push([0, corridorStart]);
  }
  if (corridorStart + 2 < LANE_COUNT) {
    regions.push([corridorStart + 2, LANE_COUNT - corridorStart - 2]);
  }
  const wanted = 1 + (rand(state, 100) < 45 ? 1 : 0);
  const chosen = wanted >= regions.length ? regions : [regions[rand(state, regions.length)]];
  return chosen.map(([first, lanes], i) => {
    const span = 1 + rand(state, Math.min(2, lanes));
    const start = first + rand(state, lanes - span + 1);
    return { at: at + i * px(20), kind: 'boulder' as const, x: (start + span / 2) * LANE_WIDTH, hp: hpFor(), w: span * LANE_WIDTH - px(8) };
  });
}

function planNormalStage(state: OrangeState, stage: number): void {
  const base = state.stageStart;
  const dps = anchorFirepower(stage);
  const challenge = challengePercent(stage);
  // 접근하는 동안(약 11초) 계속 쏘면 줄 수 있는 피해(적중 계수 반영). 곱셈 중간값이 커지지 않게 먼저 나눠서 계산한다.
  const window = Math.floor((dps * 11 * HIT_EFFICIENCY_PERCENT) / 100);
  const queue: Spawn[] = [];
  queue.push({ at: base + px(60), kind: 'gate', x: 0, gate: planGate(state, stage) });

  // 거대 귤 덩어리: 체력 숫자가 "내 화력으로 부술 수 있나" 를 알려 준다. 길은 언제나 연속 2줄 이상 비어 있어 움직임만으로 피할 수 있다.
  const boulderHp = (): number => Math.max(10, Math.floor((window * challenge * (60 + rand(state, 80))) / 10000));
  queue.push(...boulderBand(state, stage, base + px(240), boulderHp));
  if (stage >= 8 && rand(state, 100) < 35) {
    queue.push(...boulderBand(state, stage, base + px(520), boulderHp));
  }

  // 몰려오는 무리: 전체 체력은 기준 화력의 약 3.5초치. 무한 모드에서는 수가 늘고(상한 있음) 더 빠르게 달려든다.
  const crowdMax = 28 + Math.min(INFINITE.extraCrowdCap, infiniteLevel(stage));
  const count = Math.min(crowdMax, 3 + Math.floor((stage * 11) / 10) + rand(state, 3));
  const crowdHp = Math.max(2, Math.floor((Math.floor((dps * 7 * HIT_EFFICIENCY_PERCENT) / 200) * challenge) / (100 * count)));
  queue.push({ at: base + px(480), kind: 'crowd', x: px(60) + rand(state, FIELD.width - px(120)), hp: crowdHp, count });

  if (stage >= 4) {
    const bruteCount = 1 + (stage >= 9 ? 1 : 0);
    for (let i = 0; i < bruteCount; i += 1) {
      queue.push({ at: base + px(600) + i * px(30), kind: 'brute', x: laneCenter(rand(state, LANE_COUNT)), hp: Math.max(4, Math.floor((Math.floor((dps * 3 * HIT_EFFICIENCY_PERCENT) / 100) * challenge) / 100)) });
    }
  }
  if (stage % 3 === 0) {
    queue.push({ at: base + px(430), kind: 'item', x: px(60) + rand(state, FIELD.width - px(120)), item: 'orange' });
  }
  queue.sort((a, b) => a.at - b.at);
  state.queue = queue;
}

function startStage(state: OrangeState): void {
  state.stage += 1;
  state.stageStart = state.distance;
  state.events.push({ t: 'stage', n: state.stage });
  if (state.stage === INFINITE_FROM_STAGE) {
    state.events.push({ t: 'infinite' });
  }
  if (state.stage % STAGE.bossEvery === 0) {
    const index = state.stage / STAGE.bossEvery;
    const levelPercent = 100 + infiniteLevel(state.stage) * INFINITE.bossPercentPerLevel;
    const hp = Math.floor((Math.floor((anchorFirepower(state.stage) * BOSS.seconds * (100 + (index - 1) * BOSS.growthPercent)) / 100) * levelPercent) / 100);
    state.queue = [{ at: state.distance, kind: 'boss', x: FIELD.width / 2, hp }];
    state.bossActive = true;
    state.events.push({ t: 'bossIntro' });
    return;
  }
  planNormalStage(state, state.stage);
}

function newEnemy(state: OrangeState, kind: EnemyKind, x: number, z: number, hp: number, w?: number): Enemy {
  const base = ENEMY[kind];
  const enemy: Enemy = {
    id: takeId(state),
    kind,
    x,
    z,
    w: w ?? base.w,
    depth: base.depth,
    hp,
    maxHp: hp,
    speed: base.speed + (kind === 'grunt' || kind === 'brute' ? crowdSpeedBonus(state.stage) : 0),
    flash: 0,
    shielded: 0,
    born: state.tick,
    seed: rand(state, 1000),
  };
  state.enemies.push(enemy);
  return enemy;
}

// ---------------------------------------------------------------------------------------------- 판정

function overlapX(ax: number, aw: number, bx: number, bw: number): boolean {
  return Math.abs(ax - bx) * 2 < aw + bw;
}

function overlapZ(az: number, ad: number, bz: number, bd: number): boolean {
  return Math.abs(az - bz) * 2 < ad + bd;
}

function hitPlayer(state: OrangeState, cause: 'touch' | 'shot'): boolean {
  const p = state.player;
  if (p.star > 0 || p.invuln > 0) {
    return false;
  }
  if (p.shield > 0) {
    p.shield -= 1;
    p.invuln = PLAYER.invulnTicksAfterShield;
    state.events.push({ t: 'shieldBreak', x: p.x });
    return true;
  }
  state.over = true;
  state.events.push({ t: 'over', cause });
  return true;
}

function award(state: OrangeState, points: number): number {
  const gained = points * comboMultiplier(state.combo) * (state.player.cash > 0 ? 2 : 1);
  state.score += gained;
  return gained;
}

function dropItem(state: OrangeState, x: number, z: number, percent: number): void {
  if (percent < 100 && rand(state, 100) >= percent) {
    return;
  }
  const total = Object.values(ITEM_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = rand(state, total);
  let kind: ItemKind = 'orange';
  for (const [name, weight] of Object.entries(ITEM_WEIGHTS) as [ItemKind, number][]) {
    if (roll < weight) {
      kind = name;
      break;
    }
    roll -= weight;
  }
  state.items.push({ id: takeId(state), kind, x, z });
}

function killEnemy(state: OrangeState, enemy: Enemy): void {
  const base = ENEMY[enemy.kind];
  state.kills += 1;
  state.combo += 1;
  state.comboTimer = COMBO.window;
  const points = award(state, Math.floor((base.points * (100 + 10 * (state.stage - 1))) / 100));
  state.events.push({ t: 'kill', kind: enemy.kind, x: enemy.x, z: enemy.z, points });
  if (enemy.kind === 'boulder') {
    dropItem(state, enemy.x, enemy.z, ITEM.dropBoulder);
  } else if (enemy.kind === 'brute') {
    dropItem(state, enemy.x, enemy.z, ITEM.dropBrute);
  } else if (enemy.kind === 'grunt') {
    dropItem(state, enemy.x, enemy.z, ITEM.dropGrunt);
  }
  if (enemy.kind === 'boss') {
    const index = Math.floor(state.stage / STAGE.bossEvery);
    state.score += BOSS.killBonus * index;
    state.dumbbells = [];
    state.events.push({ t: 'bossDown', x: enemy.x, z: enemy.z });
    state.items.push({ id: takeId(state), kind: 'orange', x: enemy.x, z: enemy.z });
    state.gates.push({ id: takeId(state), z: FIELD.depth, ...planGate(state, state.stage), used: false });
    state.bossActive = false;
    state.afterBossTimer = STAGE.afterBoss;
  }
}

function applyGate(state: OrangeState, gate: Gate, chosen: GateEffect): void {
  const p = state.player;
  const v = chosen.value;
  switch (chosen.kind) {
    case 'shotsUp':
      p.shots = Math.min(shotsCap(state.stage), p.shots + v);
      break;
    case 'shotsMul':
      p.shots = Math.min(shotsCap(state.stage), p.shots * v);
      break;
    case 'rateUp':
      p.interval = Math.max(intervalFloor(state.stage), p.interval - v);
      break;
    case 'dmgUp':
      p.damage = Math.min(damageCap(state.stage), p.damage + v);
      break;
    case 'shotsDown':
      p.shots = Math.max(1, p.shots - v);
      break;
    case 'shotsHalf':
      p.shots = Math.max(1, Math.floor(p.shots / v));
      break;
    case 'dmgDown':
      p.damage = Math.max(1, Math.floor((p.damage * (100 - v)) / 100));
      break;
    case 'rateDown':
      p.interval = Math.min(PLAYER.slowestInterval, p.interval + v);
      break;
  }
  gate.used = true;
  state.events.push({ t: 'gate', kind: chosen.kind, value: v, x: p.x });
}

/** 총알이 지나간 게이트는 이로운 + 계열 값이 조금씩 올라간다(쏠수록 커진다, 한도 있음). 배수(×)와 함정은 변하지 않는다. */
function growGate(hit: GateEffect): void {
  hit.hits += 1;
  const shots = hit.kind === 'shotsUp';
  if (!shots && hit.kind !== 'dmgUp' && hit.kind !== 'rateUp') {
    return;
  }
  if (hit.hits % (shots ? GATE.hitsPerStepShots : GATE.hitsPerStepOther) === 0) {
    hit.value = Math.min(hit.start + GATE.maxGain, hit.value + 1);
  }
}

function collect(state: OrangeState, item: Item): void {
  const p = state.player;
  switch (item.kind) {
    case 'orange':
      p.shield = Math.min(PLAYER.maxShield, p.shield + 1);
      break;
    case 'chicken':
      p.chicken = POWER.chickenTicks;
      break;
    case 'cash':
      p.cash = POWER.cashTicks;
      break;
    case 'star':
      p.star = POWER.starTicks;
      break;
    case 'pierce':
      p.pierce = POWER.pierceTicks;
      break;
    case 'bomb':
      detonate(state);
      break;
  }
  state.events.push({ t: 'item', kind: item.kind, x: item.x });
}

/** 귤 폭탄: 가까이 있는 모든 적에게 한꺼번에 피해를 준다(보스는 일부만). */
function detonate(state: OrangeState): void {
  const p = state.player;
  const damage = BOMB.base + p.damage * p.shots * BOMB.perVolley;
  for (const enemy of state.enemies) {
    if (enemy.z - enemy.depth / 2 <= BOMB.range) {
      enemy.hp -= enemy.kind === 'boss' ? Math.floor((damage * BOMB.bossPercent) / 100) : damage;
      enemy.flash = 6;
    }
  }
  state.events.push({ t: 'bomb', x: p.x });
}

// ---------------------------------------------------------------------------------------------- 진행

function fire(state: OrangeState): void {
  const p = state.player;
  if (p.cooldown > 0) {
    p.cooldown -= 1;
    return;
  }
  const n = p.shots;
  const interval = p.chicken > 0 ? Math.max(PLAYER.minInterval, Math.floor(p.interval / 2)) : p.interval;
  const spacing = Math.min(BULLET.spacing, Math.floor(BULLET.maxSpan / n));
  for (let i = 0; i < n; i += 1) {
    const centered = 2 * i - (n - 1);
    state.bullets.push({
      id: takeId(state),
      x: p.x + Math.trunc((centered * spacing) / 2),
      z: px(20),
      vx: Math.trunc((centered * BULLET.fanStep) / 2),
      damage: p.damage,
      pierce: p.pierce > 0 ? BULLET.pierceHits : 0,
      gateId: 0,
      lastHit: 0,
    });
  }
  p.cooldown = interval - 1;
}

function moveBullets(state: OrangeState): void {
  const survivors: Bullet[] = [];
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx;
    bullet.z += BULLET.speed;
    if (bullet.z > FIELD.depth || bullet.x < -px(20) || bullet.x > FIELD.width + px(20)) {
      continue;
    }
    // 게이트: 총알은 그대로 통과하고, 지나가며 이로운 쪽 값을 키운다(총알마다 게이트당 한 번)
    for (const gate of state.gates) {
      if (!gate.used && bullet.gateId !== gate.id && overlapZ(bullet.z, BULLET.depth, gate.z, GATE.depth)) {
        growGate(gateZoneAt(gate, state.tick, bullet.x).effect);
        bullet.gateId = gate.id;
        break;
      }
    }
    // 적: 가장 가까운(z 가 작은) 한 마리에게 피해를 준다
    let target: Enemy | null = null;
    for (const enemy of state.enemies) {
      if (enemy.id !== bullet.lastHit && overlapX(bullet.x, BULLET.width, enemy.x, enemy.w) && overlapZ(bullet.z, BULLET.depth, enemy.z, enemy.depth)) {
        if (target === null || enemy.z < target.z) {
          target = enemy;
        }
      }
    }
    if (target !== null) {
      if (target.shielded <= 0) {
        target.hp -= bullet.damage;
        target.flash = 4;
      }
      bullet.lastHit = target.id;
      if (bullet.pierce > 0) {
        bullet.pierce -= 1;
        survivors.push(bullet);
      }
      continue;
    }
    survivors.push(bullet);
  }
  state.bullets = survivors;
}

function moveEnemies(state: OrangeState, runSpeed: number): void {
  const p = state.player;
  for (const enemy of state.enemies) {
    if (enemy.flash > 0) {
      enemy.flash -= 1;
    }
    if (enemy.kind === 'boss') {
      continue;
    }
    enemy.z -= runSpeed + enemy.speed;
    if (enemy.kind === 'grunt' || enemy.kind === 'brute') {
      // 도로롱 쪽으로 슬금슬금 몰려든다
      const dx = p.x - enemy.x;
      enemy.x += Math.max(-px(0.3), Math.min(px(0.3), Math.trunc(dx / 40)));
    }
  }
}

function updateBoss(state: OrangeState, boss: Enemy): void {
  const age = state.tick - boss.born;
  if (boss.z > BOSS.holdZ) {
    boss.z -= boss.speed;
    return;
  }
  const direction = (Math.floor(age / 150) % 2 === 0 ? 1 : -1) * BOSS.moveSpeed;
  boss.x = Math.min(FIELD.width - boss.w / 2, Math.max(boss.w / 2, boss.x + direction));
  const phase2 = boss.hp * 2 < boss.maxHp;
  const every = phase2 ? BOSS.throwEveryPhase2 : BOSS.throwEvery;
  if (age % every === 0) {
    const volley = phase2 ? 2 : 1;
    for (let i = 0; i < volley; i += 1) {
      const aimX = state.player.x + (i === 0 ? 0 : px(60) * (rand(state, 2) === 0 ? -1 : 1));
      const ticksToReach = Math.max(1, Math.floor(boss.z / BOSS.dumbbellSpeed));
      state.dumbbells.push({ id: takeId(state), x: boss.x, z: boss.z, vx: Math.trunc((aimX - boss.x) / ticksToReach) });
    }
  }
  if (phase2) {
    if (boss.shielded > 0) {
      boss.shielded -= 1;
      if (boss.shielded === 0) {
        state.events.push({ t: 'bossShield', on: false });
      }
    } else if (age % BOSS.shieldEvery === BOSS.shieldEvery - 1) {
      boss.shielded = BOSS.shieldTicks;
      state.events.push({ t: 'bossShield', on: true });
    }
  }
}

function resolveEnemies(state: OrangeState): void {
  const p = state.player;
  const survivors: Enemy[] = [];
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      killEnemy(state, enemy);
      continue;
    }
    if (enemy.kind !== 'boss' && enemy.z + enemy.depth / 2 < -px(40)) {
      continue;
    }
    // 몸통이 도로롱과 깊이가 겹칠 때만 부딪힌다(이미 지나쳐 뒤에 있는 적에게는 옆으로 움직여도 닿지 않는다)
    if (enemy.kind !== 'boss' && overlapZ(0, PLAYER.depth, enemy.z, enemy.depth) && overlapX(p.x, PLAYER.hitWidth, enemy.x, enemy.w)) {
      if (hitPlayer(state, 'touch')) {
        continue;
      }
    }
    survivors.push(enemy);
  }
  state.enemies = survivors;
}

function moveDumbbells(state: OrangeState): void {
  const p = state.player;
  const survivors: Dumbbell[] = [];
  for (const d of state.dumbbells) {
    d.x += d.vx;
    d.z -= BOSS.dumbbellSpeed;
    if (d.z < -px(30)) {
      continue;
    }
    if (overlapZ(0, PLAYER.depth, d.z, px(14)) && overlapX(p.x, PLAYER.hitWidth, d.x, BOSS.dumbbellWidth)) {
      hitPlayer(state, 'shot');
      continue;
    }
    survivors.push(d);
  }
  state.dumbbells = survivors;
}

function moveGates(state: OrangeState, runSpeed: number): void {
  const p = state.player;
  state.gates = state.gates.filter((gate) => {
    gate.z -= runSpeed;
    if (!gate.used && gate.z <= 0) {
      applyGate(state, gate, gateZoneAt(gate, state.tick, p.x).effect);
    }
    return !gate.used && gate.z > -px(30);
  });
}

function moveItems(state: OrangeState, runSpeed: number): void {
  const p = state.player;
  const survivors: Item[] = [];
  for (const item of state.items) {
    item.z -= runSpeed;
    if (item.z <= 0 && item.z > -px(30) && overlapX(p.x, PLAYER.pickupWidth, item.x, ITEM.width)) {
      collect(state, item);
      continue;
    }
    if (item.z > -px(30)) {
      survivors.push(item);
    }
  }
  state.items = survivors;
}

function tickTimers(state: OrangeState): void {
  const p = state.player;
  p.invuln = Math.max(0, p.invuln - 1);
  p.chicken = Math.max(0, p.chicken - 1);
  p.cash = Math.max(0, p.cash - 1);
  p.star = Math.max(0, p.star - 1);
  p.pierce = Math.max(0, p.pierce - 1);
  if (state.comboTimer > 0) {
    state.comboTimer -= 1;
    if (state.comboTimer === 0) {
      state.combo = 0;
    }
  }
}

function runSpawns(state: OrangeState): void {
  while (state.queue.length > 0 && state.queue[0].at <= state.distance) {
    const spawn = state.queue.shift() as Spawn;
    switch (spawn.kind) {
      case 'gate':
        if (spawn.gate) {
          state.gates.push({ id: takeId(state), z: FIELD.depth, zones: spawn.gate.zones, sway: spawn.gate.sway, used: false });
        }
        break;
      case 'item':
        state.items.push({ id: takeId(state), kind: spawn.item ?? 'orange', x: spawn.x, z: FIELD.depth });
        break;
      case 'crowd': {
        const count = spawn.count ?? 1;
        for (let i = 0; i < count; i += 1) {
          const x = Math.min(FIELD.width - px(16), Math.max(px(16), spawn.x + rand(state, px(110)) - px(55)));
          newEnemy(state, 'grunt', x, FIELD.depth + rand(state, px(160)), spawn.hp ?? 2);
        }
        break;
      }
      default:
        newEnemy(state, spawn.kind, spawn.x, FIELD.depth, spawn.hp ?? 1, spawn.w);
    }
  }
}

function advanceStage(state: OrangeState, running: boolean): void {
  if (state.stage % STAGE.bossEvery === 0) {
    // 보스 스테이지는 보스를 쓰러뜨리면 잠깐 쉬었다가 다음 스테이지가 시작된다
    if (!state.bossActive && state.afterBossTimer > 0) {
      state.afterBossTimer -= 1;
      if (state.afterBossTimer === 0) {
        startStage(state);
      }
    }
    return;
  }
  if (running && state.distance >= state.stageStart + STAGE.length) {
    state.score += 50 * state.stage;
    startStage(state);
  }
}

/** 한 프레임 진행한다. 상태를 직접 바꾼다. 끝난 판은 그대로 둔다. */
export function step(state: OrangeState, input: OrangeInput): void {
  state.events = [];
  if (state.over) {
    return;
  }
  state.tick += 1;
  const p = state.player;

  p.targetX = Math.min(FIELD.width - PLAYER.width / 2, Math.max(PLAYER.width / 2, input.targetX));
  const delta = p.targetX - p.x;
  p.x += Math.abs(delta) <= PLAYER.speed ? delta : delta > 0 ? PLAYER.speed : -PLAYER.speed;

  // 보스가 자리를 잡으면 도로롱은 멈춰 서서 싸운다(세계가 다가오지 않는다)
  const boss = state.enemies.find((e) => e.kind === 'boss');
  const holding = boss !== undefined && boss.z <= BOSS.holdZ;
  const runSpeed = holding ? 0 : runSpeedFor(state.stage);
  state.scroll += runSpeed;
  const bossStage = state.stage % STAGE.bossEvery === 0;
  if (!bossStage) {
    state.distance += runSpeed;
  }

  fire(state);
  runSpawns(state);
  moveBullets(state);
  moveEnemies(state, runSpeed);
  if (boss) {
    updateBoss(state, boss);
  }
  resolveEnemies(state);
  moveDumbbells(state);
  moveGates(state, runSpeed);
  moveItems(state, runSpeed);
  tickTimers(state);
  advanceStage(state, !bossStage);
}

export function scoreOf(state: OrangeState): number {
  return state.score;
}
