import { useEffect, useRef } from 'react';
import type { GameComponentProps } from '../registry';
import { loadSprites, type Sprites } from './assets';
import { applyEvent, createEffects, updateEffects, type Effects } from './effects';
import { FIELD, STEP_MS, createState, step, type OrangeState } from './engine';
import { GAME_OVER_LINES, TIPS, pick } from './jokes';
import { drawScene, type Phase } from './render';
import { VIEW } from './view';

/** 그림 파일이 있는 곳. 운영에서는 게이트웨이가 이 경로를 객체 저장소로 연결한다. */
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;
/** 판이 끝난 직후에는 이 시간 동안 재시작 입력을 무시한다(움직이던 손가락이 바로 다시 시작하지 않게) */
const RESTART_LOCK_MS = 700;
/** 한 번에 따라잡을 수 있는 최대 시간. 탭이 숨겨졌다 돌아왔을 때 한꺼번에 진행하지 않게 한다. */
const MAX_CATCH_UP_MS = 100;
const SEED_BOUND = 0x100000000;

function newSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % SEED_BOUND;
}

/** 귤 폭격 도로롱 Canvas. 규칙은 engine.ts, 연출은 effects.ts·render.ts 에 있고, 이 컴포넌트는 입력과 반복(루프)을 맡는다. */
export default function OrangeGame({ best, onStart, onGameOver }: GameComponentProps) {
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
    canvas.width = VIEW.width * dpr;
    canvas.height = VIEW.height * dpr;
    ctx.scale(dpr, dpr);

    const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    let state: OrangeState = createState(newSeed());
    let fx: Effects = createEffects();
    let sprites: Sprites = {};
    let phase: Phase = 'idle';
    let overAt = 0;
    let overLine = '';
    let tip = pick(TIPS, Math.floor(Math.random() * TIPS.length));
    const keys = { left: false, right: false };
    let pointerX: number | null = null;
    let frameId = 0;
    let last = performance.now();
    let accumulator = 0;

    const abort = new AbortController();
    void loadSprites(ASSET_BASE, abort.signal).then((loaded) => {
      sprites = loaded;
    });

    const begin = () => {
      state = createState(newSeed());
      fx = createEffects();
      phase = 'playing';
      accumulator = 0;
      last = performance.now();
      onStartRef.current();
    };
    const pressStart = () => {
      if (phase === 'idle' || (phase === 'over' && performance.now() - overAt > RESTART_LOCK_MS)) {
        begin();
      }
    };

    const targetX = (): number => {
      if (pointerX !== null) {
        return pointerX;
      }
      if (keys.left !== keys.right) {
        return keys.left ? 0 : FIELD.width;
      }
      return state.player.x;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        event.preventDefault();
        keys.left = true;
        pressStart();
      } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        event.preventDefault();
        keys.right = true;
        pressStart();
      } else if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        pressStart();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        keys.left = false;
      } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        keys.right = false;
      }
    };
    const toField = (clientX: number): number => {
      const rect = canvas.getBoundingClientRect();
      return Math.min(FIELD.width, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * FIELD.width)));
    };
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      pointerX = toField(event.clientX);
      pressStart();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (pointerX !== null) {
        pointerX = toField(event.clientX);
      }
    };
    const onPointerUp = () => {
      pointerX = null;
    };
    const releaseAll = () => {
      keys.left = false;
      keys.right = false;
      pointerX = null;
    };

    const frame = (now: number) => {
      accumulator += Math.min(now - last, MAX_CATCH_UP_MS);
      last = now;
      if (phase === 'playing') {
        while (accumulator >= STEP_MS && !state.over) {
          step(state, { targetX: targetX() });
          for (const event of state.events) {
            applyEvent(fx, event, Math.random);
            if (event.t === 'over') {
              overLine = pick(GAME_OVER_LINES[event.cause], Math.floor(Math.random() * 100));
            }
          }
          updateEffects(fx);
          accumulator -= STEP_MS;
        }
        if (state.over) {
          phase = 'over';
          overAt = performance.now();
          releaseAll();
          tip = pick(TIPS, Math.floor(Math.random() * TIPS.length));
          onGameOverRef.current(state.score);
        }
      } else {
        updateEffects(fx);
      }
      drawScene(ctx, { state, fx, sprites, phase, best: bestRef.current, tip, overLine, touch });
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      abort.abort();
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return (
    <div className="mx-auto" style={{ width: `min(100%, calc(78vh * ${VIEW.width} / ${VIEW.height}))` }}>
      <canvas
        ref={canvasRef}
        aria-label="귤 폭격 도로롱 게임 화면"
        className="block w-full touch-none select-none rounded-xl border border-slate-700 bg-slate-950"
        style={{ aspectRatio: `${VIEW.width} / ${VIEW.height}` }}
      />
    </div>
  );
}

