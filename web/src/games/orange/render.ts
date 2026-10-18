import type { Sprites, SpriteKey } from './assets';
import type { Effects } from './effects';
import { COLORS } from './effects';
import {
  FIELD,
  PLAYER,
  PX,
  comboMultiplier,
  type Enemy,
  type Gate,
  type GateEffect,
  type ItemKind,
  type OrangeState,
} from './engine';
import { BOSS_NAME, GATE_TITLES, gateValueText, isTrap, pick, rankTitle } from './jokes';

/** 그리기 전용. 상태를 읽기만 하고 바꾸지 않는다. 그림이 없으면 도형으로 대신 그린다. */

export const VIEW = { width: FIELD.width / PX, height: FIELD.height / PX } as const;

export type Phase = 'idle' | 'playing' | 'over';

export interface Scene {
  state: OrangeState;
  fx: Effects;
  sprites: Sprites;
  phase: Phase;
  best: number | null;
  tip: string;
  overLine: string;
  touch: boolean;
}

const FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
const PALETTE = {
  skyTop: '#10243d',
  skyBottom: '#0b1220',
  gateGood: 'rgba(56, 189, 248, 0.5)',
  gateMul: 'rgba(250, 204, 21, 0.55)',
  gateTrap: 'rgba(248, 113, 113, 0.55)',
  hpBack: 'rgba(15, 23, 42, 0.7)',
  hpFill: '#f87171',
} as const;

const ITEM_EMOJI: Record<ItemKind, string> = { orange: '🍊', chicken: '🍗', cash: '💰', star: '⭐' };
const ITEM_SPRITE: Record<ItemKind, SpriteKey> = { orange: 'orange', chicken: 'chicken', cash: 'cash', star: 'star' };

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, options: { weight?: string; align?: CanvasTextAlign } = {}): void {
  ctx.font = `${options.weight ?? '700'} ${size}px ${FONT}`;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 5);
  ctx.strokeStyle = 'rgba(8, 15, 30, 0.85)';
  ctx.lineJoin = 'round';
  ctx.strokeText(value, x, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/** 상자 안에 비율을 지켜 그림을 그린다. 아래쪽 가운데가 기준(발 위치). */
function drawImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, cx: number, cy: number, w: number, h: number): void {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  ctx.drawImage(image, cx - dw / 2, cy - dh / 2, dw, dh);
}

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function eyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, spread: number, size: number, angry: boolean): void {
  ctx.fillStyle = '#fff';
  for (const dx of [-spread, spread]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(cx + dx, cy + size * 0.2, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
  }
  if (angry) {
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - spread - size, cy - size * 1.4);
    ctx.lineTo(cx - spread + size, cy - size * 0.6);
    ctx.moveTo(cx + spread + size, cy - size * 1.4);
    ctx.lineTo(cx + spread - size, cy - size * 0.6);
    ctx.stroke();
  }
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, key: SpriteKey, cx: number, cy: number, w: number, h: number): void {
  switch (key) {
    case 'hero':
      blob(ctx, cx, cy + h * 0.15, w * 0.9, h * 0.7, '#fff');
      blob(ctx, cx, cy - h * 0.1, w * 1.0, h * 0.62, '#f9a8d4');
      eyes(ctx, cx, cy - h * 0.05, w * 0.2, w * 0.1, false);
      break;
    case 'swarm':
      blob(ctx, cx, cy, w, h * 0.85, '#64748b');
      eyes(ctx, cx, cy - 1, w * 0.2, w * 0.11, true);
      break;
    case 'slime':
      blob(ctx, cx, cy + 2, w, h * 0.9, '#4ade80');
      eyes(ctx, cx, cy, w * 0.2, w * 0.1, false);
      break;
    case 'wall':
      ctx.fillStyle = '#b4783c';
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      ctx.fillStyle = '#8a5a2b';
      for (let x = cx - w / 2; x < cx + w / 2; x += w / 4) {
        ctx.fillRect(x, cy - 1, 2, h / 2 + 1);
        ctx.fillRect(x + w / 8, cy - h / 2, 2, h / 2);
      }
      break;
    case 'elite':
      blob(ctx, cx, cy + 2, w, h * 0.85, '#a855f7');
      eyes(ctx, cx, cy, w * 0.2, w * 0.1, true);
      ctx.font = `${w * 0.4}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('👑', cx, cy - h * 0.45);
      break;
    case 'boss':
      ctx.fillStyle = '#f6c8a0';
      ctx.fillRect(cx - w * 0.3, cy - h * 0.5, w * 0.6, h);
      blob(ctx, cx - w * 0.42, cy, w * 0.32, w * 0.32, '#f6c8a0');
      blob(ctx, cx + w * 0.42, cy, w * 0.32, w * 0.32, '#f6c8a0');
      eyes(ctx, cx, cy - h * 0.25, w * 0.12, w * 0.06, true);
      ctx.font = `${w * 0.28}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('💪', cx, cy + h * 0.15);
      break;
    case 'orange':
    case 'chicken':
    case 'cash':
    case 'star':
      ctx.font = `${Math.min(w, h)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ITEM_EMOJI[key], cx, cy);
      break;
    case 'bg':
      break;
  }
}

function sprite(ctx: CanvasRenderingContext2D, sprites: Sprites, key: SpriteKey, cx: number, cy: number, w: number, h: number): void {
  const image = sprites[key];
  if (image) {
    drawImage(ctx, image, cx, cy, w, h);
  } else {
    drawPlaceholder(ctx, key, cx, cy, w, h);
  }
}

function drawLaneDashes(ctx: CanvasRenderingContext2D, scroll: number, alpha: number): void {
  ctx.strokeStyle = `rgba(226, 232, 240, ${alpha})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([22, 26]);
  ctx.lineDashOffset = -scroll;
  for (let x = 60; x < VIEW.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW.height);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBackground(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { state, sprites } = scene;
  const scroll = (state.tick * 0.9) % VIEW.height;
  const bg = sprites.bg;
  if (bg) {
    // 그림은 이어 붙이면 이음매가 보여서 화면을 꽉 채워 한 장으로 그리고, 움직임은 차선으로 보여 준다
    const scale = Math.max(VIEW.width / bg.naturalWidth, VIEW.height / bg.naturalHeight);
    const w = bg.naturalWidth * scale;
    const h = bg.naturalHeight * scale;
    ctx.drawImage(bg, (VIEW.width - w) / 2, (VIEW.height - h) / 2, w, h);
    ctx.fillStyle = 'rgba(8, 15, 30, 0.42)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawLaneDashes(ctx, scroll, 0.14);
    return;
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawLaneDashes(ctx, scroll, 0.18);
}

function drawGate(ctx: CanvasRenderingContext2D, gate: Gate): void {
  const y = gate.y / PX;
  const height = 40;
  const halves: [GateEffect, number][] = [
    [gate.left, 4],
    [gate.right, VIEW.width / 2 + 2],
  ];
  halves.forEach(([effectOf, x], index) => {
    const w = VIEW.width / 2 - 6;
    const trap = isTrap(effectOf.kind);
    ctx.fillStyle = trap ? PALETTE.gateTrap : effectOf.kind === 'shotsMul' ? PALETTE.gateMul : PALETTE.gateGood;
    ctx.fillRect(x, y - height / 2, w, height);
    ctx.strokeStyle = trap ? '#f87171' : effectOf.kind === 'shotsMul' ? '#facc15' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y - height / 2, w, height);
    const title = pick(GATE_TITLES[effectOf.kind], gate.id + index);
    text(ctx, title, x + w / 2, y - 11, 11, '#e2e8f0', { weight: '600' });
    text(ctx, gateValueText(effectOf.kind, effectOf.value), x + w / 2, y + 8, 20, trap ? COLORS.trap : '#fff');
  });
}

function drawEnemy(ctx: CanvasRenderingContext2D, scene: Scene, enemy: Enemy): void {
  const cx = enemy.x / PX;
  const cy = enemy.y / PX;
  const w = enemy.w / PX;
  const h = enemy.h / PX;
  const key: SpriteKey = enemy.kind === 'mini' ? 'slime' : enemy.kind;
  ctx.save();
  if (enemy.kind === 'mini') {
    ctx.globalAlpha = 0.95;
  }
  if (enemy.shielded > 0) {
    ctx.globalAlpha = 0.7;
  }
  sprite(ctx, scene.sprites, key, cx, cy, w * 1.15, h * 1.15);
  if (enemy.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    sprite(ctx, scene.sprites, key, cx, cy, w * 1.15, h * 1.15);
  }
  ctx.restore();
  if (enemy.shielded > 0) {
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.62, h * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (enemy.kind !== 'boss' && enemy.kind !== 'swarm' && enemy.kind !== 'mini' && enemy.hp < enemy.maxHp) {
    ctx.fillStyle = PALETTE.hpBack;
    ctx.fillRect(cx - w / 2, cy - h / 2 - 7, w, 4);
    ctx.fillStyle = PALETTE.hpFill;
    ctx.fillRect(cx - w / 2, cy - h / 2 - 7, (w * enemy.hp) / enemy.maxHp, 4);
  }
}

function drawDumbbell(ctx: CanvasRenderingContext2D, x: number, y: number, tick: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tick * 0.18);
  ctx.fillStyle = '#475569';
  ctx.fillRect(-3, -14, 6, 28);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-9, -16, 18, 7);
  ctx.fillRect(-9, 9, 18, 7);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { state } = scene;
  const p = state.player;
  const cx = p.x / PX;
  const cy = PLAYER.y / PX;
  const w = PLAYER.width / PX;
  const h = PLAYER.height / PX;
  const pulse = 1 + Math.sin(state.tick * 0.2) * 0.04;
  if (p.star > 0) {
    ctx.fillStyle = `rgba(253, 224, 71, ${0.25 + Math.sin(state.tick * 0.3) * 0.1})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  if (p.invuln > 0 && Math.floor(state.tick / 4) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }
  const bob = state.over ? 0 : Math.sin(state.tick * 0.25) * 1.5;
  sprite(ctx, scene.sprites, 'hero', cx, cy + bob, w * 1.5, h * 1.5);
  ctx.restore();
  for (let i = 0; i < p.shield; i += 1) {
    ctx.strokeStyle = i === 0 ? 'rgba(251, 146, 60, 0.95)' : 'rgba(253, 186, 116, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 28 + i * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { state, best } = scene;
  text(ctx, String(state.score), 12, 20, 24, '#fff', { align: 'left' });
  text(ctx, `WAVE ${state.wave}`, VIEW.width - 12, 16, 15, '#cbd5e1', { align: 'right' });
  if (best !== null) {
    text(ctx, `BEST ${best}`, VIEW.width - 12, 36, 12, '#94a3b8', { align: 'right', weight: '600' });
  }
  if (state.combo >= 3) {
    text(ctx, `COMBO ${state.combo}  ×${comboMultiplier(state.combo)}`, 12, 44, 13, COLORS.gold, { align: 'left' });
  }
  const p = state.player;
  const icons: [string, number, number][] = [
    ['🍗', p.chicken, 360],
    ['💰', p.cash, 480],
    ['⭐', p.star, 300],
  ];
  let x = 12;
  for (const [emoji, ticks, max] of icons) {
    if (ticks <= 0) {
      continue;
    }
    ctx.font = `16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(emoji, x, VIEW.height - 40);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(x, VIEW.height - 26, 22, 3);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x, VIEW.height - 26, (22 * Math.min(ticks, max)) / max, 3);
    x += 30;
  }
  text(ctx, `🔫 ${p.shots}발 · 공격 ${p.damage}`, VIEW.width - 12, VIEW.height - 14, 12, '#cbd5e1', { align: 'right', weight: '600' });
  const boss = state.enemies.find((e) => e.kind === 'boss');
  if (boss) {
    const w = VIEW.width - 80;
    ctx.fillStyle = PALETTE.hpBack;
    ctx.fillRect(40, 60, w, 8);
    ctx.fillStyle = boss.shielded > 0 ? '#fde047' : PALETTE.hpFill;
    ctx.fillRect(40, 60, (w * Math.max(0, boss.hp)) / boss.maxHp, 8);
    text(ctx, BOSS_NAME, VIEW.width / 2, 78, 12, '#fff');
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { phase, state } = scene;
  if (phase === 'playing') {
    return;
  }
  ctx.fillStyle = 'rgba(8, 15, 30, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (phase === 'idle') {
    text(ctx, '귤 폭격', VIEW.width / 2, 200, 40, COLORS.orange);
    text(ctx, '도로롱', VIEW.width / 2, 246, 40, '#f9a8d4');
    text(ctx, scene.touch ? '화면을 좌우로 끌어서 움직여요' : '← → 또는 A D 로 움직여요', VIEW.width / 2, 320, 15, '#e2e8f0', { weight: '600' });
    text(ctx, '총알은 알아서 나가요', VIEW.width / 2, 346, 15, '#e2e8f0', { weight: '600' });
    text(ctx, '한 번 맞으면 끝! 귤이 있으면 한 번은 막아요', VIEW.width / 2, 372, 13, '#fca5a5', { weight: '600' });
    text(ctx, scene.touch ? '탭해서 시작' : '스페이스 · 클릭으로 시작', VIEW.width / 2, 430, 20, '#fff');
    text(ctx, `TIP  ${scene.tip}`, VIEW.width / 2, 520, 13, '#94a3b8', { weight: '600' });
    return;
  }
  text(ctx, 'GAME OVER', VIEW.width / 2, 190, 36, '#fca5a5');
  text(ctx, scene.overLine, VIEW.width / 2, 236, 16, '#e2e8f0', { weight: '600' });
  text(ctx, String(state.score), VIEW.width / 2, 300, 44, '#fff');
  text(ctx, rankTitle(state.score), VIEW.width / 2, 348, 20, COLORS.gold);
  text(ctx, `WAVE ${state.wave} · 처치 ${state.kills}`, VIEW.width / 2, 384, 14, '#cbd5e1', { weight: '600' });
  text(ctx, scene.touch ? '탭해서 다시 시작' : '스페이스 · 클릭으로 다시 시작', VIEW.width / 2, 450, 18, '#fff');
}

function drawBanner(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const banner = scene.fx.banner;
  if (!banner) {
    return;
  }
  const t = banner.age / banner.life;
  const alpha = t < 0.12 ? t / 0.12 : t > 0.8 ? (1 - t) / 0.2 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  const big = banner.sub !== '';
  text(ctx, banner.title, VIEW.width / 2, big ? 150 : 130, big ? 30 : 26, big ? COLORS.orange : '#e2e8f0');
  if (big) {
    text(ctx, `"${banner.sub}"`, VIEW.width / 2, 186, 16, '#fff', { weight: '600' });
  }
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { state, fx } = scene;
  ctx.save();
  if (fx.shake > 0) {
    const m = fx.shake * 0.5;
    ctx.translate(Math.sin(state.tick * 7) * m, Math.cos(state.tick * 9) * m);
  }
  drawBackground(ctx, scene);
  state.gates.forEach((gate) => drawGate(ctx, gate));
  state.items.forEach((item) => {
    const bob = Math.sin((state.tick + item.id * 7) * 0.15) * 3;
    sprite(ctx, scene.sprites, ITEM_SPRITE[item.kind], item.x / PX, item.y / PX + bob, 28, 28);
  });
  state.enemies.forEach((enemy) => drawEnemy(ctx, scene, enemy));
  state.enemyShots.forEach((shot) => drawDumbbell(ctx, shot.x / PX, shot.y / PX, state.tick));
  state.bullets.forEach((bullet) => {
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.ellipse(bullet.x / PX, bullet.y / PX, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.ellipse(bullet.x / PX - 1, bullet.y / PX - 2, 1.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  drawPlayer(ctx, scene);
  fx.particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  fx.texts.forEach((t) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, (t.life - t.age) / 18));
    text(ctx, t.text, t.x, t.y, t.size, t.color);
  });
  ctx.globalAlpha = 1;
  drawHud(ctx, scene);
  drawBanner(ctx, scene);
  ctx.restore();
  drawOverlay(ctx, scene);
}
