/**
 * 도로 러너의 게임 규칙. 화면(Canvas)과 분리된 순수 로직이라 같은 시드와 같은 입력이면 항상 같은 결과가 나온다.
 * (서버가 판을 다시 재생해 점수를 검증하는 단계로 가기 위한 전제이다.)
 *
 * 좌표는 픽셀이고, 한 번의 {@link step} 은 정확히 한 프레임(1/60 초)이다.
 */

export const FPS = 60;
export const STEP_MS = 1000 / FPS;

export const WORLD = {
  width: 640,
  height: 200,
  /** 바닥선의 y(화면 위쪽이 0) */
  groundY: 160,
} as const;

export const PLAYER = {
  x: 48,
  width: 32,
  height: 34,
  duckHeight: 22,
  duckWidth: 38,
} as const;

const PHYSICS = {
  gravity: 0.62,
  jumpVelocity: 10.8,
  /** 공중에서 숙이면 더 빨리 내려온다 */
  fastFallFactor: 2.2,
} as const;

const SPEED = {
  initial: 6,
  max: 13,
  acceleration: 0.0016,
} as const;

/** 크롬 공룡 게임과 비슷한 비율: 달린 거리 1px 당 0.025 점. 최고 속도에서도 초당 약 20점이다. */
export const SCORE_PER_PIXEL = 0.025;

const OBSTACLE = {
  minGap: 260,
  gapPerSpeed: 22,
  gapRandom: 220,
  coneWidth: 20,
  coneHeight: 34,
  droneWidth: 40,
  droneHeight: 18,
  /** 숙여야 피하는 높이(서 있으면 부딪히고, 숙이면 지나간다) */
  droneLowBottom: 24,
  /** 서 있으면 지나가는 높이(점프하면 부딪힌다) */
  droneHighBottom: 56,
  /** 이 점수부터 드론이 나온다 */
  droneFromScore: 150,
  droneChance: 0.35,
  /** 닿았다고 보는 기준을 조금 느슨하게(눈에 보이는 모양보다 작은 판정) */
  hitMargin: 4,
} as const;

export type ObstacleKind = 'cone' | 'drone';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  /** 바닥에서 몸 아래쪽까지의 높이 */
  bottom: number;
  width: number;
  height: number;
}

export interface RunnerState {
  tick: number;
  /** 바닥에서 발까지의 높이(0 = 땅 위) */
  playerBottom: number;
  velocityY: number;
  ducking: boolean;
  obstacles: Obstacle[];
  speed: number;
  distance: number;
  /** 다음 장애물이 나올 때까지 남은 거리(px) */
  gapRemaining: number;
  rng: number;
  over: boolean;
}

export interface RunnerInput {
  jump: boolean;
  duck: boolean;
}

/** mulberry32: 상태 한 개(32비트 정수)로 이어서 뽑을 수 있는 작은 난수 생성기 */
export function nextRandom(seed: number): { value: number; next: number } {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, next };
}

export function createState(seed: number): RunnerState {
  return {
    tick: 0,
    playerBottom: 0,
    velocityY: 0,
    ducking: false,
    obstacles: [],
    speed: SPEED.initial,
    distance: 0,
    gapRemaining: WORLD.width * 0.6,
    rng: seed >>> 0,
    over: false,
  };
}

export function scoreOf(state: RunnerState): number {
  return Math.floor(state.distance * SCORE_PER_PIXEL);
}

export function playerSize(state: RunnerState): { width: number; height: number } {
  const grounded = state.playerBottom === 0;
  return state.ducking && grounded
    ? { width: PLAYER.duckWidth, height: PLAYER.duckHeight }
    : { width: PLAYER.width, height: PLAYER.height };
}

function random(state: RunnerState): number {
  const { value, next } = nextRandom(state.rng);
  state.rng = next;
  return value;
}

function spawnObstacle(state: RunnerState): void {
  const droneAllowed = scoreOf(state) >= OBSTACLE.droneFromScore;
  if (droneAllowed && random(state) < OBSTACLE.droneChance) {
    const low = random(state) < 0.5;
    state.obstacles.push({
      kind: 'drone',
      x: WORLD.width,
      bottom: low ? OBSTACLE.droneLowBottom : OBSTACLE.droneHighBottom,
      width: OBSTACLE.droneWidth,
      height: OBSTACLE.droneHeight,
    });
  } else {
    state.obstacles.push({ kind: 'cone', x: WORLD.width, bottom: 0, width: OBSTACLE.coneWidth, height: OBSTACLE.coneHeight });
  }
  state.gapRemaining = OBSTACLE.minGap + state.speed * OBSTACLE.gapPerSpeed + random(state) * OBSTACLE.gapRandom;
}

function hits(state: RunnerState, obstacle: Obstacle): boolean {
  const size = playerSize(state);
  const margin = OBSTACLE.hitMargin;
  const px1 = PLAYER.x + margin;
  const px2 = PLAYER.x + size.width - margin;
  const pb = state.playerBottom + margin;
  const pt = state.playerBottom + size.height - margin;
  const ox1 = obstacle.x + margin;
  const ox2 = obstacle.x + obstacle.width - margin;
  const ob = obstacle.bottom + margin;
  const ot = obstacle.bottom + obstacle.height - margin;
  return px1 < ox2 && px2 > ox1 && pb < ot && pt > ob;
}

/** 한 프레임 진행한다. 상태를 직접 바꾼다. 이미 끝난 판은 그대로 둔다. */
export function step(state: RunnerState, input: RunnerInput): void {
  if (state.over) {
    return;
  }
  state.tick += 1;

  const onGround = state.playerBottom === 0;
  state.ducking = input.duck;
  if (input.jump && onGround) {
    state.velocityY = PHYSICS.jumpVelocity;
  }
  if (state.velocityY !== 0 || state.playerBottom > 0) {
    const gravity = input.duck ? PHYSICS.gravity * PHYSICS.fastFallFactor : PHYSICS.gravity;
    state.playerBottom += state.velocityY;
    state.velocityY -= gravity;
    if (state.playerBottom <= 0) {
      state.playerBottom = 0;
      state.velocityY = 0;
    }
  }

  state.speed = Math.min(SPEED.max, state.speed + SPEED.acceleration);
  state.distance += state.speed;

  for (const obstacle of state.obstacles) {
    obstacle.x -= state.speed;
  }
  state.obstacles = state.obstacles.filter((o) => o.x + o.width > 0);

  state.gapRemaining -= state.speed;
  if (state.gapRemaining <= 0) {
    spawnObstacle(state);
  }

  if (state.obstacles.some((o) => hits(state, o))) {
    state.over = true;
  }
}
