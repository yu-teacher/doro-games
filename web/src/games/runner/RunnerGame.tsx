import { useEffect, useRef } from 'react';
import playerSpriteUrl from './assets/player.png';
import {
  PLAYER,
  STEP_MS,
  WORLD,
  createState,
  playerSize,
  scoreOf,
  step,
  type Obstacle,
  type RunnerInput,
  type RunnerState,
} from './engine';

interface RunnerGameProps {
  /** 내 최고 기록(없으면 null). 화면 위쪽에 보여 준다. */
  best: number | null;
  /** 새 판이 시작될 때 */
  onStart: () => void;
  /** 판이 끝났을 때(점수는 엔진이 센 값) */
  onGameOver: (score: number) => void;
}

type Phase = 'idle' | 'playing' | 'over';

const COLORS = {
  sky: '#0b1220',
  road: '#1e293b',
  roadEdge: '#475569',
  lane: '#94a3b8',
  player: '#f9a8d4',
  cone: '#fb923c',
  coneStripe: '#f8fafc',
  drone: '#f472b6',
  droneRotor: '#fdf2f8',
  text: '#e2e8f0',
  textDim: '#94a3b8',
} as const;

const LANE_DASH = 28;
const LANE_PERIOD = 64;
/** 판이 끝난 직후에는 이 시간 동안 재시작 입력을 무시한다(달리던 손가락이 바로 다시 시작하지 않게) */
const RESTART_LOCK_MS = 600;
/** 한 번에 따라잡을 수 있는 최대 시간. 탭이 숨겨졌다 돌아왔을 때 한꺼번에 달리지 않게 한다. */
const MAX_CATCH_UP_MS = 100;
const SEED_BOUND = 0x100000000;

function newSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % SEED_BOUND;
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, tick: number): void {
  const top = WORLD.groundY - o.bottom - o.height;
  if (o.kind === 'cone') {
    ctx.fillStyle = COLORS.cone;
    ctx.beginPath();
    ctx.moveTo(o.x + o.width / 2, top);
    ctx.lineTo(o.x + o.width, top + o.height);
    ctx.lineTo(o.x, top + o.height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.coneStripe;
    ctx.fillRect(o.x + o.width * 0.25, top + o.height * 0.45, o.width * 0.5, 4);
    return;
  }
  ctx.fillStyle = COLORS.drone;
  ctx.fillRect(o.x + 6, top + 6, o.width - 12, o.height - 6);
  // 프로펠러: 프레임마다 모양이 바뀌어 돌아가는 것처럼 보인다
  ctx.fillStyle = COLORS.droneRotor;
  const wide = Math.floor(tick / 4) % 2 === 0;
  ctx.fillRect(o.x + (wide ? 0 : 6), top + 2, o.width - (wide ? 0 : 12), 3);
}

/** 캐릭터 그림(오른쪽을 보는 모습). 아직 불러오는 중이면 사각형으로 대신 그린다. */
const playerSprite = new Image();
playerSprite.src = playerSpriteUrl;

const SPRITE = {
  /** 화면에 그리는 높이. 판정(PLAYER)보다 조금 커서 몸이 장애물에 살짝 겹쳐 보여도 억울하지 않다. */
  height: 52,
  /** 달릴 때 통통 튀는 높이와 속도 */
  bounce: 4,
  bounceRate: 0.32,
  /** 달릴 때 몸이 좌우로 기우는 각도(라디안) */
  wobble: 0.07,
  /** 점프 중 속도에 따라 몸을 기울이는 정도 */
  jumpTilt: 0.012,
  /** 숙일 때 납작해지는 비율 */
  duckSquashY: 0.62,
  duckSquashX: 1.18,
  /** 점프할 때 길쭉해지는 비율 */
  airStretchY: 1.1,
  airStretchX: 0.92,
  /** 게임 오버로 쓰러진 각도 */
  fallenTilt: -0.9,
} as const;

function drawPlayer(ctx: CanvasRenderingContext2D, state: RunnerState): void {
  const size = playerSize(state);
  const grounded = state.playerBottom === 0;
  const centerX = PLAYER.x + size.width / 2;
  const feetY = WORLD.groundY - state.playerBottom;

  let scaleX = 1;
  let scaleY = 1;
  let tilt = 0;
  let lift = 0;
  if (state.over) {
    tilt = SPRITE.fallenTilt;
  } else if (!grounded) {
    scaleX = SPRITE.airStretchX;
    scaleY = SPRITE.airStretchY;
    tilt = -state.velocityY * SPRITE.jumpTilt;
  } else if (state.ducking) {
    scaleX = SPRITE.duckSquashX;
    scaleY = SPRITE.duckSquashY;
  } else {
    const phase = state.tick * SPRITE.bounceRate;
    lift = Math.abs(Math.sin(phase)) * SPRITE.bounce;
    tilt = Math.sin(phase) * SPRITE.wobble;
  }

  const height = SPRITE.height;
  const ready = playerSprite.complete && playerSprite.naturalWidth > 0;
  const width = ready ? (height * playerSprite.naturalWidth) / playerSprite.naturalHeight : size.width;

  ctx.save();
  ctx.translate(centerX, feetY - lift);
  ctx.rotate(tilt);
  ctx.scale(scaleX, scaleY);
  if (ready) {
    ctx.drawImage(playerSprite, -width / 2, -height, width, height);
  } else {
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(-size.width / 2, -size.height, size.width, size.height);
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: RunnerState, phase: Phase, best: number | null): void {
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = COLORS.road;
  ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);
  ctx.fillStyle = COLORS.roadEdge;
  ctx.fillRect(0, WORLD.groundY, WORLD.width, 2);
  // 차선: 달린 거리만큼 뒤로 흘러간다
  ctx.fillStyle = COLORS.lane;
  const offset = state.distance % LANE_PERIOD;
  for (let x = -offset; x < WORLD.width; x += LANE_PERIOD) {
    ctx.fillRect(x, WORLD.groundY + 22, LANE_DASH, 3);
  }

  state.obstacles.forEach((o) => drawObstacle(ctx, o, state.tick));
  drawPlayer(ctx, state);

  ctx.font = '600 16px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(String(scoreOf(state)).padStart(5, '0'), WORLD.width - 12, 24);
  if (best !== null) {
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`BEST ${String(best).padStart(5, '0')}`, WORLD.width - 84, 24);
  }

  ctx.textAlign = 'center';
  if (phase === 'idle') {
    ctx.fillStyle = COLORS.text;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('스페이스 · ↑ · 화면 터치로 시작', WORLD.width / 2, 74);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('↓ 또는 화면 아래쪽을 누르면 숙여요', WORLD.width / 2, 98);
  } else if (phase === 'over') {
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText('GAME OVER', WORLD.width / 2, 70);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('스페이스 · 터치로 다시 시작', WORLD.width / 2, 96);
  }
}

/** 도로 러너 Canvas. 규칙은 engine.ts 에 있고, 이 컴포넌트는 입력을 모으고 그리는 일만 한다. */
export default function RunnerGame({ best, onStart, onGameOver }: RunnerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bestRef = useRef(best);
  const onStartRef = useRef(onStart);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    bestRef.current = best;
    onStartRef.current = onStart;
    onGameOverRef.current = onGameOver;
  }, [best, onStart, onGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return undefined;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WORLD.width * dpr;
    canvas.height = WORLD.height * dpr;
    ctx.scale(dpr, dpr);

    let state = createState(newSeed());
    let phase: Phase = 'idle';
    let overAt = 0;
    const input: RunnerInput = { jump: false, duck: false };
    let frameId = 0;
    let last = performance.now();
    let accumulator = 0;

    const begin = () => {
      state = createState(newSeed());
      phase = 'playing';
      accumulator = 0;
      last = performance.now();
      onStartRef.current();
    };
    const pressJump = () => {
      if (phase === 'idle' || (phase === 'over' && performance.now() - overAt > RESTART_LOCK_MS)) {
        begin();
      }
      input.jump = true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        pressJump();
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        input.duck = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        input.jump = false;
      } else if (event.code === 'ArrowDown') {
        input.duck = false;
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const lowerThird = event.clientY - rect.top > (rect.height * 2) / 3;
      if (lowerThird && phase === 'playing') {
        input.duck = true;
      } else {
        pressJump();
      }
    };
    const onPointerUp = () => {
      input.jump = false;
      input.duck = false;
    };
    const releaseAll = () => {
      input.jump = false;
      input.duck = false;
    };

    const frame = (now: number) => {
      accumulator += Math.min(now - last, MAX_CATCH_UP_MS);
      last = now;
      if (phase === 'playing') {
        while (accumulator >= STEP_MS && !state.over) {
          step(state, input);
          accumulator -= STEP_MS;
        }
        if (state.over) {
          phase = 'over';
          overAt = performance.now();
          input.jump = false;
          input.duck = false;
          onGameOverRef.current(scoreOf(state));
        }
      }
      draw(ctx, state, phase, bestRef.current);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="도로 러너 게임 화면"
      className="block w-full touch-none select-none rounded-xl border border-slate-700 bg-slate-950"
      style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
    />
  );
}
