/**
 * 「귤 폭격 도로롱」의 게임 규칙. 화면과 분리된 순수 로직이다.
 *
 * - **정수만 쓴다.** 좌표는 1px = PX(100) 단위의 정수이고 나눗셈은 항상 내림이다. 부동소수점이 없어서 같은 시드와 같은 입력이면
 *   어디서 돌려도(브라우저, 서버의 재생 검증) 똑같은 결과가 나온다.
 * - 한 번의 {@link step} 은 정확히 한 프레임(1/60 초)이다.
 * - 한 방 컷: 한 번 맞으면 끝이다. 귤(보호막)이 있으면 한 번은 막는다.
 * - 화면 효과(말풍선, 반짝임)는 여기서 정하지 않는다. 엔진은 {@link GameEvent} 만 내보내고, 연출은 화면이 맡는다.
 */

export const FPS = 60;
export const STEP_MS = 1000 / FPS;

/** 1px 을 나타내는 정수 단위(서브픽셀). */
export const PX = 100;
export const px = (n: number): number => Math.round(n * PX);

export const FIELD = { width: px(360), height: px(640) } as const;

export const PLAYER = {
  width: px(36),
  height: px(40),
  /** 맞았는지 따질 때는 눈에 보이는 몸보다 작게 쓴다 */
  hitWidth: px(22),
  hitHeight: px(26),
  y: px(572),
  speed: px(8),
  startShots: 3,
  startInterval: 10,
  startDamage: 1,
  maxShots: 40,
  minInterval: 4,
  maxDamage: 99,
  maxShield: 2,
  invulnTicksAfterShield: 60,
} as const;

const BULLET = { width: px(6), height: px(14), speed: px(14), fanStep: 55, maxSpan: px(120), spacing: px(7) } as const;

const WAVE = {
  /** 줄 사이 간격(틱): 웨이브가 올라가면 촘촘해진다 */
  rowGapStart: 84,
  rowGapMin: 38,
  baseRows: 4,
  maxExtraRows: 6,
  tail: 150,
  gateDelay: 90,
  bossEvery: 10,
  bossEnterTick: 30,
  afterBoss: 150,
  lanes: 6,
  laneWidth: px(60),
} as const;

const GATE = {
  height: px(40),
  speed: 120,
  /** 총알을 이 횟수만큼 맞을 때마다 + 계열 값이 1 오른다(총알 수는 빨리, 공격력·연사는 느리게) */
  hitsPerStepShots: 8,
  hitsPerStepOther: 16,
  /** 쏴서 키울 수 있는 최대 증가량(원래 값 기준) */
  maxGain: 8,
} as const;

const ITEM = { size: px(26), speed: px(1.6), dropPercent: 4, orangeWeight: 40, chickenWeight: 25, cashWeight: 20, starWeight: 15 } as const;

const POWER = { chickenTicks: 360, cashTicks: 480, starTicks: 300 } as const;

const COMBO = { window: 90, perStep: 10, maxMultiplier: 5 } as const;

/** 종류별 기본 값. hp 는 웨이브에 따라 커진다(hpScale). */
const ENEMY = {
  swarm: { w: px(30), h: px(30), hp: 3, vy: 90, points: 10 },
  mini: { w: px(22), h: px(22), hp: 4, vy: 110, points: 5 },
  slime: { w: px(40), h: px(34), hp: 12, vy: 60, points: 40 },
  wall: { w: px(120), h: px(36), hp: 40, vy: 40, points: 150 },
  elite: { w: px(42), h: px(42), hp: 26, vy: 80, points: 200 },
  boss: { w: px(140), h: px(130), hp: 420, vy: 100, points: 2000 },
} as const;

const SCALE = { hpPerWave: 16, hpPerWaveSquared: 5, speedPerWave: 3, maxSpeedBonus: 110 } as const;

const BOSS = {
  hoverY: px(130),
  moveSpeed: px(1.5),
  throwEvery: 90,
  throwEveryPhase2: 60,
  shotSpeed: px(4),
  shotSize: px(22),
  shieldEvery: 480,
  shieldTicks: 120,
  killBonus: 1000,
  rewardOranges: 1,
} as const;

export const WAVE_BOSS_EVERY = WAVE.bossEvery;

export type EnemyKind = keyof typeof ENEMY;
export type ItemKind = 'orange' | 'chicken' | 'cash' | 'star';

/** 게이트가 하는 일. + 와 × 는 총알 수, rate 는 연사, dmg 는 공격력. 마이너스 쪽(shotsDown, shotsHalf)은 함정이다. */
export type GateKind = 'shotsUp' | 'shotsMul' | 'rateUp' | 'dmgUp' | 'shotsDown' | 'shotsHalf';

export interface GateEffect {
  kind: GateKind;
  value: number;
  /** 게이트가 만들어졌을 때의 값(키울 수 있는 한도를 정하는 기준) */
  start: number;
  /** 지금까지 맞은 총알 수 */
  hits: number;
}

export interface Gate {
  id: number;
  y: number;
  left: GateEffect;
  right: GateEffect;
  used: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  /** 좌우로 흔들리기 전의 기준 x */
  baseX: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  vy: number;
  vx: number;
  /** 맞았을 때 하얗게 번쩍이는 남은 틱(그리기용) */
  flash: number;
  /** 보스가 막고 있는 남은 틱 */
  shielded: number;
  born: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  damage: number;
}

export interface EnemyShot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
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
}

interface Spawn {
  at: number;
  kind: EnemyKind | 'gate';
  x: number;
  gate?: { left: GateEffect; right: GateEffect };
}

export type GameEvent =
  | { t: 'kill'; kind: EnemyKind; x: number; y: number; points: number }
  | { t: 'gate'; kind: GateKind; value: number; x: number; y: number }
  | { t: 'item'; kind: ItemKind; x: number; y: number }
  | { t: 'shieldBreak'; x: number; y: number }
  | { t: 'wave'; n: number }
  | { t: 'bossIntro' }
  | { t: 'bossShield'; on: boolean }
  | { t: 'bossDown'; x: number; y: number }
  | { t: 'over'; cause: 'touch' | 'breach' | 'shot' };

export interface OrangeState {
  tick: number;
  rng: number;
  nextId: number;
  player: Player;
  bullets: Bullet[];
  enemies: Enemy[];
  enemyShots: EnemyShot[];
  gates: Gate[];
  items: Item[];
  wave: number;
  waveTick: number;
  waveLength: number;
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
    },
    bullets: [],
    enemies: [],
    enemyShots: [],
    gates: [],
    items: [],
    wave: 0,
    waveTick: 0,
    waveLength: 0,
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
  startWave(state);
  return state;
}

/** 웨이브 번호에 따른 체력 배율(%). */
export function hpScalePercent(wave: number): number {
  const n = wave - 1;
  return 100 + n * SCALE.hpPerWave + n * n * SCALE.hpPerWaveSquared;
}

function scaledHp(base: number, wave: number): number {
  return Math.max(1, Math.floor((base * hpScalePercent(wave)) / 100));
}

function speedFor(base: number, wave: number): number {
  return base + Math.min(SCALE.maxSpeedBonus, (wave - 1) * SCALE.speedPerWave);
}

function laneCenter(lane: number): number {
  return lane * WAVE.laneWidth + WAVE.laneWidth / 2;
}

export function effect(kind: GateKind, value: number): GateEffect {
  return { kind, value, start: value, hits: 0 };
}

function goodGate(state: OrangeState, wave: number): GateEffect {
  const roll = rand(state, 100);
  if (roll < 38) {
    return effect('shotsUp', 2 + Math.floor(wave / 4));
  }
  if (roll < 56 && wave >= 2) {
    return effect('shotsMul', 2);
  }
  if (roll < 78) {
    return effect('rateUp', 2);
  }
  return effect('dmgUp', 1 + Math.floor(wave / 6));
}

function trapGate(state: OrangeState, wave: number): GateEffect {
  return wave >= 5 && rand(state, 100) < 40 ? effect('shotsHalf', 2) : effect('shotsDown', 2 + Math.floor(wave / 8));
}

/** 게이트 한 쌍: 적어도 한쪽은 이로운 선택지이고, 다른 쪽은 이롭거나 함정이다. */
function planGate(state: OrangeState, wave: number): { left: GateEffect; right: GateEffect } {
  const good = goodGate(state, wave);
  const other = rand(state, 100) < 45 ? trapGate(state, wave) : goodGate(state, wave);
  return rand(state, 2) === 0 ? { left: good, right: other } : { left: other, right: good };
}

function planNormalWave(state: OrangeState, wave: number): void {
  const rows = WAVE.baseRows + Math.min(WAVE.maxExtraRows, Math.floor(wave / 3));
  const rowGap = Math.max(WAVE.rowGapMin, WAVE.rowGapStart - wave * 2);
  const queue: Spawn[] = [];
  for (let row = 0; row < rows; row += 1) {
    const at = row * rowGap;
    const lanes = Array.from({ length: WAVE.lanes }, (_, i) => i);
    for (let i = lanes.length - 1; i > 0; i -= 1) {
      const j = rand(state, i + 1);
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const count = 1 + rand(state, 1 + Math.min(3, Math.ceil(wave / 2)));
    for (let k = 0; k < count; k += 1) {
      const roll = rand(state, 100);
      let kind: EnemyKind = 'swarm';
      if (k === 0 && wave >= 4 && roll < 14) {
        kind = 'wall';
      } else if (k === 0 && wave >= 3 && roll < 32) {
        kind = 'slime';
      }
      queue.push({ at, kind, x: kind === 'wall' ? FIELD.width / 2 + (rand(state, 3) - 1) * WAVE.laneWidth : laneCenter(lanes[k]) });
    }
    if (wave % 3 === 0 && row === rows - 1) {
      queue.push({ at: at + 10, kind: 'elite', x: laneCenter(rand(state, WAVE.lanes)) });
    }
  }
  queue.push({ at: rows * rowGap + WAVE.gateDelay, kind: 'gate', x: 0, gate: planGate(state, wave) });
  queue.sort((a, b) => a.at - b.at);
  state.queue = queue;
  state.waveLength = queue[queue.length - 1].at + WAVE.tail;
}

function startWave(state: OrangeState): void {
  state.wave += 1;
  state.waveTick = 0;
  state.events.push({ t: 'wave', n: state.wave });
  if (state.wave % WAVE.bossEvery === 0) {
    state.queue = [{ at: WAVE.bossEnterTick, kind: 'boss', x: FIELD.width / 2 }];
    state.waveLength = Number.MAX_SAFE_INTEGER;
    state.bossActive = true;
    state.events.push({ t: 'bossIntro' });
    return;
  }
  planNormalWave(state, state.wave);
}

function spawnEnemy(state: OrangeState, kind: EnemyKind, x: number, y: number, vx = 0): Enemy {
  const base = ENEMY[kind];
  const boss = kind === 'boss';
  const bossScale = boss ? 100 + (Math.floor(state.wave / WAVE.bossEvery) - 1) * 70 : 100;
  const hp = Math.max(1, Math.floor((scaledHp(base.hp, state.wave) * bossScale) / 100));
  const enemy: Enemy = {
    id: takeId(state),
    kind,
    baseX: x,
    x,
    y,
    w: base.w,
    h: base.h,
    hp,
    maxHp: hp,
    vy: boss ? 0 : speedFor(base.vy, state.wave),
    vx,
    flash: 0,
    shielded: 0,
    born: state.tick,
  };
  state.enemies.push(enemy);
  return enemy;
}

// ---------------------------------------------------------------------------------------------- 판정

function overlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
}

function hitPlayer(state: OrangeState, cause: 'touch' | 'breach' | 'shot'): boolean {
  const p = state.player;
  if (p.star > 0 || p.invuln > 0) {
    return false;
  }
  if (p.shield > 0) {
    p.shield -= 1;
    p.invuln = PLAYER.invulnTicksAfterShield;
    state.events.push({ t: 'shieldBreak', x: p.x, y: PLAYER.y });
    return true;
  }
  state.over = true;
  state.events.push({ t: 'over', cause });
  return true;
}

export function comboMultiplier(combo: number): number {
  return Math.min(COMBO.maxMultiplier, 1 + Math.floor(combo / COMBO.perStep));
}

function award(state: OrangeState, points: number): number {
  const gained = points * comboMultiplier(state.combo) * (state.player.cash > 0 ? 2 : 1);
  state.score += gained;
  return gained;
}

function dropItem(state: OrangeState, x: number, y: number, forced: boolean): void {
  if (!forced && rand(state, 100) >= ITEM.dropPercent) {
    return;
  }
  const total = ITEM.orangeWeight + ITEM.chickenWeight + ITEM.cashWeight + ITEM.starWeight;
  let roll = rand(state, total);
  let kind: ItemKind = 'orange';
  if (roll >= ITEM.orangeWeight) {
    roll -= ITEM.orangeWeight;
    kind = 'chicken';
    if (roll >= ITEM.chickenWeight) {
      roll -= ITEM.chickenWeight;
      kind = roll < ITEM.cashWeight ? 'cash' : 'star';
    }
  }
  state.items.push({ id: takeId(state), kind, x, y });
}

function killEnemy(state: OrangeState, enemy: Enemy): void {
  const base = ENEMY[enemy.kind];
  state.kills += 1;
  state.combo += 1;
  state.comboTimer = COMBO.window;
  const points = award(state, base.points);
  state.events.push({ t: 'kill', kind: enemy.kind, x: enemy.x, y: enemy.y, points });
  if (enemy.kind === 'slime') {
    spawnEnemy(state, 'mini', enemy.x - px(12), enemy.y, -px(0.6));
    spawnEnemy(state, 'mini', enemy.x + px(12), enemy.y, px(0.6));
  }
  if (enemy.kind === 'elite') {
    dropItem(state, enemy.x, enemy.y, true);
  } else if (enemy.kind !== 'boss') {
    dropItem(state, enemy.x, enemy.y, false);
  }
  if (enemy.kind === 'boss') {
    state.score += BOSS.killBonus * Math.floor(state.wave / WAVE.bossEvery);
    state.enemyShots = [];
    state.events.push({ t: 'bossDown', x: enemy.x, y: enemy.y });
    for (let i = 0; i < BOSS.rewardOranges; i += 1) {
      state.items.push({ id: takeId(state), kind: 'orange', x: enemy.x + (i - 0) * px(20), y: enemy.y });
    }
    state.gates.push({ id: takeId(state), y: -GATE.height, ...planGate(state, state.wave), used: false });
    state.bossActive = false;
    state.afterBossTimer = WAVE.afterBoss;
  }
}

function applyGate(state: OrangeState, gate: Gate, effectChosen: GateEffect): void {
  const p = state.player;
  const v = effectChosen.value;
  switch (effectChosen.kind) {
    case 'shotsUp':
      p.shots = Math.min(PLAYER.maxShots, p.shots + v);
      break;
    case 'shotsMul':
      p.shots = Math.min(PLAYER.maxShots, p.shots * v);
      break;
    case 'rateUp':
      p.interval = Math.max(PLAYER.minInterval, p.interval - v);
      break;
    case 'dmgUp':
      p.damage = Math.min(PLAYER.maxDamage, p.damage + v);
      break;
    case 'shotsDown':
      p.shots = Math.max(1, p.shots - v);
      break;
    case 'shotsHalf':
      p.shots = Math.max(1, Math.floor(p.shots / v));
      break;
  }
  gate.used = true;
  state.events.push({ t: 'gate', kind: effectChosen.kind, value: v, x: p.x, y: PLAYER.y });
}

/** 총알을 맞은 게이트는 이로운 + 계열 값이 조금씩 올라간다(쏠수록 커진다, 한도 있음). 배수(×)와 함정은 변하지 않는다. */
function growGate(hitEffect: GateEffect): void {
  hitEffect.hits += 1;
  const shots = hitEffect.kind === 'shotsUp';
  if (!shots && hitEffect.kind !== 'dmgUp' && hitEffect.kind !== 'rateUp') {
    return;
  }
  if (hitEffect.hits % (shots ? GATE.hitsPerStepShots : GATE.hitsPerStepOther) === 0) {
    hitEffect.value = Math.min(hitEffect.start + GATE.maxGain, hitEffect.value + 1);
  }
}

// ---------------------------------------------------------------------------------------------- 진행

function fire(state: OrangeState): void {
  const p = state.player;
  const n = p.shots;
  const interval = p.chicken > 0 ? Math.max(PLAYER.minInterval, Math.floor(p.interval / 2)) : p.interval;
  if (p.cooldown > 0) {
    p.cooldown -= 1;
    return;
  }
  const spacing = Math.min(BULLET.spacing, Math.floor(BULLET.maxSpan / n));
  for (let i = 0; i < n; i += 1) {
    const centered = 2 * i - (n - 1);
    state.bullets.push({
      id: takeId(state),
      x: p.x + Math.trunc((centered * spacing) / 2),
      y: PLAYER.y - PLAYER.height / 2,
      vx: Math.trunc((centered * BULLET.fanStep) / 2),
      damage: p.damage,
    });
  }
  p.cooldown = interval - 1;
}

function moveBullets(state: OrangeState): void {
  const survivors: Bullet[] = [];
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx;
    bullet.y -= BULLET.speed;
    if (bullet.y < -BULLET.height || bullet.x < -px(20) || bullet.x > FIELD.width + px(20)) {
      continue;
    }
    // 게이트: 총알을 막고 값을 키운다
    let consumed = false;
    for (const gate of state.gates) {
      if (gate.used || Math.abs(bullet.y - gate.y) * 2 >= GATE.height + BULLET.height) {
        continue;
      }
      growGate(bullet.x < FIELD.width / 2 ? gate.left : gate.right);
      consumed = true;
      break;
    }
    if (consumed) {
      continue;
    }
    // 적: 먼저 닿은 한 마리에게 피해를 준다
    for (const enemy of state.enemies) {
      if (overlap(bullet.x, bullet.y, BULLET.width, BULLET.height, enemy.x, enemy.y, enemy.w, enemy.h)) {
        if (enemy.shielded <= 0) {
          enemy.hp -= bullet.damage;
          enemy.flash = 4;
        }
        consumed = true;
        break;
      }
    }
    if (!consumed) {
      survivors.push(bullet);
    }
  }
  state.bullets = survivors;
}

function moveEnemies(state: OrangeState): void {
  for (const enemy of state.enemies) {
    if (enemy.flash > 0) {
      enemy.flash -= 1;
    }
    if (enemy.kind === 'boss') {
      continue;
    }
    enemy.y += enemy.vy;
    if (enemy.kind === 'swarm' || enemy.kind === 'elite') {
      const phase = (state.tick + enemy.id * 13) % 120;
      const triangle = phase < 60 ? phase : 120 - phase;
      enemy.x = enemy.baseX + (triangle - 30) * 80;
    } else {
      enemy.baseX += enemy.vx;
      enemy.x = enemy.baseX;
    }
  }
}

function updateBoss(state: OrangeState, boss: Enemy): void {
  const age = state.tick - boss.born;
  if (boss.y < BOSS.hoverY) {
    boss.y += BOSS.shotSpeed / 2;
    return;
  }
  if (boss.vx === 0) {
    boss.vx = BOSS.moveSpeed;
  }
  boss.x += boss.vx;
  if (boss.x < boss.w / 2 || boss.x > FIELD.width - boss.w / 2) {
    boss.vx = -boss.vx;
    boss.x = Math.min(FIELD.width - boss.w / 2, Math.max(boss.w / 2, boss.x));
  }
  const phase2 = boss.hp * 2 < boss.maxHp;
  const every = phase2 ? BOSS.throwEveryPhase2 : BOSS.throwEvery;
  if (age % every === 0) {
    const volley = phase2 ? 2 : 1;
    for (let i = 0; i < volley; i += 1) {
      const aimX = state.player.x + (i === 0 ? 0 : px(50) * (rand(state, 2) === 0 ? -1 : 1));
      const ticksToReach = Math.max(1, Math.floor((PLAYER.y - boss.y) / BOSS.shotSpeed));
      state.enemyShots.push({
        id: takeId(state),
        x: boss.x,
        y: boss.y + boss.h / 2,
        vx: Math.trunc((aimX - boss.x) / ticksToReach),
        vy: BOSS.shotSpeed,
      });
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
    if (enemy.kind !== 'boss' && enemy.y - enemy.h / 2 > FIELD.height) {
      hitPlayer(state, 'breach');
      continue;
    }
    if (overlap(p.x, PLAYER.y, PLAYER.hitWidth, PLAYER.hitHeight, enemy.x, enemy.y, enemy.w, enemy.h)) {
      if (hitPlayer(state, 'touch') && enemy.kind !== 'boss') {
        continue;
      }
    }
    survivors.push(enemy);
  }
  state.enemies = survivors;
}

function moveEnemyShots(state: OrangeState): void {
  const p = state.player;
  const survivors: EnemyShot[] = [];
  for (const shot of state.enemyShots) {
    shot.x += shot.vx;
    shot.y += shot.vy;
    if (shot.y > FIELD.height + BOSS.shotSize || shot.x < -BOSS.shotSize || shot.x > FIELD.width + BOSS.shotSize) {
      continue;
    }
    if (overlap(p.x, PLAYER.y, PLAYER.hitWidth, PLAYER.hitHeight, shot.x, shot.y, BOSS.shotSize, BOSS.shotSize)) {
      hitPlayer(state, 'shot');
      continue;
    }
    survivors.push(shot);
  }
  state.enemyShots = survivors;
}

function moveGates(state: OrangeState): void {
  const p = state.player;
  state.gates = state.gates.filter((gate) => {
    gate.y += GATE.speed;
    if (!gate.used && Math.abs(gate.y - PLAYER.y) * 2 < GATE.height + PLAYER.hitHeight) {
      applyGate(state, gate, p.x < FIELD.width / 2 ? gate.left : gate.right);
    }
    return !gate.used && gate.y - GATE.height / 2 <= FIELD.height;
  });
}

function moveItems(state: OrangeState): void {
  const p = state.player;
  const survivors: Item[] = [];
  for (const item of state.items) {
    item.y += ITEM.speed;
    if (item.y - ITEM.size / 2 > FIELD.height) {
      continue;
    }
    if (overlap(p.x, PLAYER.y, PLAYER.width, PLAYER.height, item.x, item.y, ITEM.size, ITEM.size)) {
      collect(state, item);
      continue;
    }
    survivors.push(item);
  }
  state.items = survivors;
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
  }
  state.events.push({ t: 'item', kind: item.kind, x: item.x, y: item.y });
}

function tickTimers(state: OrangeState): void {
  const p = state.player;
  p.invuln = Math.max(0, p.invuln - 1);
  p.chicken = Math.max(0, p.chicken - 1);
  p.cash = Math.max(0, p.cash - 1);
  p.star = Math.max(0, p.star - 1);
  if (state.comboTimer > 0) {
    state.comboTimer -= 1;
    if (state.comboTimer === 0) {
      state.combo = 0;
    }
  }
}

function runSpawns(state: OrangeState): void {
  while (state.queue.length > 0 && state.queue[0].at <= state.waveTick) {
    const spawn = state.queue.shift() as Spawn;
    if (spawn.kind === 'gate' && spawn.gate) {
      state.gates.push({ id: takeId(state), y: -GATE.height, left: spawn.gate.left, right: spawn.gate.right, used: false });
    } else if (spawn.kind === 'boss') {
      spawnEnemy(state, 'boss', spawn.x, -ENEMY.boss.h);
    } else if (spawn.kind !== 'gate') {
      spawnEnemy(state, spawn.kind, spawn.x, -ENEMY[spawn.kind].h / 2);
    }
  }
}

function advanceWave(state: OrangeState): void {
  state.waveTick += 1;
  if (state.wave % WAVE.bossEvery === 0) {
    // 보스 웨이브는 보스를 쓰러뜨리면 잠깐 쉬었다가 다음 웨이브가 시작된다
    if (!state.bossActive && state.afterBossTimer > 0) {
      state.afterBossTimer -= 1;
      if (state.afterBossTimer === 0) {
        startWave(state);
      }
    }
    return;
  }
  if (state.waveTick >= state.waveLength) {
    startWave(state);
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

  fire(state);
  runSpawns(state);
  moveBullets(state);
  moveEnemies(state);
  for (const enemy of state.enemies) {
    if (enemy.kind === 'boss') {
      updateBoss(state, enemy);
    }
  }
  resolveEnemies(state);
  moveEnemyShots(state);
  moveGates(state);
  moveItems(state);
  tickTimers(state);
  advanceWave(state);
}

export function scoreOf(state: OrangeState): number {
  return state.score;
}
