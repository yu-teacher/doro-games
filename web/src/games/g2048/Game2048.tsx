import { useCallback, useEffect, useRef, useState } from 'react';
import mascotUrl from '../runner/assets/player.png';
import type { GameComponentProps } from '../registry';
import { SIZE, createState, move, type Direction, type Game2048State } from './engine';

const BOARD = 400;
const PADDING = 12;
const GAP = 10;
const CELL = (BOARD - PADDING * 2 - GAP * (SIZE - 1)) / SIZE;
const RADIUS = 10;
/** 타일이 미끄러지는 시간 */
const SLIDE_MS = 110;
/** 이 거리(px)보다 짧게 끌면 스와이프로 보지 않는다 */
const SWIPE_MIN_PX = 24;
const SEED_BOUND = 0x100000000;
/** 이 값 이상의 타일에는 마스코트가 놀러 온다 */
const MASCOT_FROM = 128;

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
};

const COLORS = {
  board: '#1e293b',
  cell: '#0f172a',
  dark: '#0f172a',
  light: '#f8fafc',
} as const;

/** 값별 타일 색(작은 값은 하늘색, 커질수록 분홍·주황으로). */
const TILE_COLORS: Record<number, string> = {
  2: '#bae6fd',
  4: '#7dd3fc',
  8: '#f9a8d4',
  16: '#f472b6',
  32: '#fb923c',
  64: '#f97316',
  128: '#facc15',
  256: '#eab308',
  512: '#a3e635',
  1024: '#34d399',
  2048: '#a78bfa',
};
const BIG_TILE_COLOR = '#7c3aed';

function newSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % SEED_BOUND;
}

function cellOrigin(row: number, col: number): { x: number; y: number } {
  return { x: PADDING + col * (CELL + GAP), y: PADDING + row * (CELL + GAP) };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const mascot = new Image();
mascot.src = mascotUrl;

function drawTile(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, scale: number): void {
  const size = CELL * scale;
  const left = x + (CELL - size) / 2;
  const top = y + (CELL - size) / 2;
  ctx.fillStyle = TILE_COLORS[value] ?? BIG_TILE_COLOR;
  roundRect(ctx, left, top, size, size, RADIUS);
  ctx.fill();

  const dark = value <= 4;
  ctx.fillStyle = dark ? COLORS.dark : COLORS.light;
  const digits = String(value).length;
  const fontSize = (digits <= 2 ? 40 : digits === 3 ? 34 : 28) * scale;
  ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), left + size / 2, top + size / 2 + (value >= MASCOT_FROM ? size * 0.1 : 0));

  if (value >= MASCOT_FROM && mascot.complete && mascot.naturalWidth > 0) {
    const w = size * 0.36;
    const h = (w * mascot.naturalHeight) / mascot.naturalWidth;
    ctx.drawImage(mascot, left + size / 2 - w / 2, top + size * 0.04, w, h);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: Game2048State, startedAt: number, now: number): void {
  ctx.clearRect(0, 0, BOARD, BOARD);
  ctx.fillStyle = COLORS.board;
  roundRect(ctx, 0, 0, BOARD, BOARD, 16);
  ctx.fill();
  ctx.fillStyle = COLORS.cell;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const { x, y } = cellOrigin(row, col);
      roundRect(ctx, x, y, CELL, CELL, RADIUS);
      ctx.fill();
    }
  }

  const t = Math.min(1, Math.max(0, (now - startedAt) / SLIDE_MS));
  const lerp = (a: number, b: number) => a + (b - a) * t;

  if (t < 1) {
    for (const ghost of state.ghosts) {
      const from = cellOrigin(ghost.fromRow, ghost.fromCol);
      const to = cellOrigin(ghost.row, ghost.col);
      drawTile(ctx, ghost.value, lerp(from.x, to.x), lerp(from.y, to.y), 1);
    }
  }
  for (const tile of state.tiles) {
    const from = cellOrigin(tile.fromRow, tile.fromCol);
    const to = cellOrigin(tile.row, tile.col);
    let scale = 1;
    if (tile.isNew) {
      // 미끄러짐이 끝날 즈음 작게 나타나 커진다
      scale = t < 0.6 ? 0 : (t - 0.6) / 0.4;
    } else if (tile.merged) {
      scale = 1 + 0.14 * Math.sin(Math.PI * t);
    }
    if (scale > 0) {
      drawTile(ctx, tile.value, lerp(from.x, to.x), lerp(from.y, to.y), scale);
    }
  }

  if (state.over) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    roundRect(ctx, 0, 0, BOARD, BOARD, 16);
    ctx.fill();
    ctx.fillStyle = COLORS.light;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 36px system-ui, sans-serif';
    ctx.fillText('GAME OVER', BOARD / 2, BOARD / 2 - 12);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('아래 "새 게임" 으로 다시 도전해요', BOARD / 2, BOARD / 2 + 26);
  }
}

/** 2048 Canvas. 규칙은 engine.ts 에 있고, 이 컴포넌트는 입력을 모으고 그리는 일만 한다. */
export default function Game2048({ best, onStart, onGameOver }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<Game2048State>(createState(newSeed()));
  const movedAtRef = useRef(0);
  const onStartRef = useRef(onStart);
  const onGameOverRef = useRef(onGameOver);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  useEffect(() => {
    onStartRef.current = onStart;
    onGameOverRef.current = onGameOver;
  }, [onStart, onGameOver]);

  const play = useCallback((direction: Direction) => {
    const state = stateRef.current;
    if (!move(state, direction)) {
      return;
    }
    movedAtRef.current = performance.now();
    setScore(state.score);
    if (state.moves === 1) {
      onStartRef.current();
    }
    if (state.over) {
      setOver(true);
      onGameOverRef.current(state.score);
    }
  }, []);

  const newGame = useCallback(() => {
    const state = stateRef.current;
    // 하던 판을 접으면 거기까지의 점수를 기록한다(2048 은 끝이 없어서 중간에 그만두는 판이 많다)
    if (state.moves > 0 && !state.over && state.score > 0) {
      onGameOverRef.current(state.score);
    }
    stateRef.current = createState(newSeed());
    movedAtRef.current = 0;
    setScore(0);
    setOver(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return undefined;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = BOARD * dpr;
    canvas.height = BOARD * dpr;
    ctx.scale(dpr, dpr);

    let frameId = 0;
    const frame = (now: number) => {
      draw(ctx, stateRef.current, movedAtRef.current, now);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);

    const onKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.code];
      if (!direction || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      event.preventDefault();
      play(direction);
    };

    let swipeStart: { x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      swipeStart = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!swipeStart) {
        return;
      }
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) {
        return;
      }
      play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    };
    const onPointerCancel = () => {
      swipeStart = null;
    };

    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [play]);

  const shownBest = Math.max(best ?? 0, score);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex gap-2 text-center">
          <div className="min-w-20 rounded-lg bg-slate-800 px-3 py-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">점수</div>
            <div className="font-mono text-lg font-bold text-slate-50">{score}</div>
          </div>
          <div className="min-w-20 rounded-lg bg-slate-800 px-3 py-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">최고</div>
            <div className="font-mono text-lg font-bold text-sky-300">{shownBest}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={newGame}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${over ? 'bg-pink-400 text-slate-950 hover:bg-pink-300' : 'border border-slate-600 text-slate-200 hover:bg-slate-800'}`}
        >
          새 게임
        </button>
      </div>
      <canvas
        ref={canvasRef}
        aria-label="2048 게임 화면"
        className="block w-full touch-none select-none rounded-2xl"
        style={{ aspectRatio: '1 / 1' }}
      />
      <p className="mt-3 text-center text-sm text-slate-500">방향키 · WASD · 화면을 밀어서 움직여요</p>
    </div>
  );
}
