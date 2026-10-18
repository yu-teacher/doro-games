import type { Sprites, SpriteKey } from './assets';
import type { Effects } from './effects';
import { COLORS } from './effects';
import {
  FIELD,
  PX,
  comboMultiplier,
  firepower,
  firepowerCap,
  gateBounds,
  infiniteLevel,
  isInfinite,
  LANE_COUNT,
  LANE_WIDTH,
  type Enemy,
  type Gate,
  type ItemKind,
  type OrangeState,
} from './engine';
import { formatCount } from './format';
import { BOSS_NAME, GATE_TITLES, HIDDEN_TEXT, HIDDEN_TITLE, WARN_BOSS, gateValueText, isTrap, pick, rankTitle } from './jokes';
import { HORIZON_Y, PLAYER_Y, VIEW, project } from './view';

/** 그리기 전용. 상태를 읽기만 하고 바꾸지 않는다. 그림이 없으면 도형으로 대신 그린다. */

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
  skyTop: '#16324f',
  skyBottom: '#0b1220',
  road: '#27364b',
  roadFar: '#1b2638',
  rail: '#e2e8f0',
  lane: 'rgba(226, 232, 240, 0.55)',
  gateGood: 'rgba(56, 189, 248, 0.55)',
  gateMul: 'rgba(250, 204, 21, 0.6)',
  gateHidden: 'rgba(139, 92, 246, 0.55)',
  gateTrap: 'rgba(248, 113, 113, 0.6)',
  hpBack: 'rgba(15, 23, 42, 0.75)',
  hpFill: '#f87171',
} as const;

/** 눈에 보이는 크기의 기준(도로롱 위치에서의 px) */
const SIZE = { hero: 60, grunt: 34, brute: 54, item: 34, bullet: 6, dumbbell: 30 } as const;
const ROAD_LEFT = 0;
const ROAD_RIGHT = FIELD.width;
const LANE_DASH = 120;

const ITEM_EMOJI: Record<ItemKind, string> = { orange: '🍊', chicken: '🍗', cash: '💰', star: '⭐', pierce: '🎯', bomb: '💣' };

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, options: { weight?: string; align?: CanvasTextAlign } = {}): void {
  ctx.font = `${options.weight ?? '800'} ${size}px ${FONT}`;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 5);
  ctx.strokeStyle = 'rgba(8, 15, 30, 0.9)';
  ctx.lineJoin = 'round';
  ctx.strokeText(value, x, y);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/** 상자 안에 비율을 지켜 그림을 그린다(가운데 기준). */
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
    ctx.lineWidth = Math.max(1, size * 0.4);
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
      blob(ctx, cx, cy + 2, w, h * 0.9, '#a78bfa');
      eyes(ctx, cx, cy, w * 0.2, w * 0.1, true);
      break;
    case 'boss':
      ctx.fillStyle = '#f6c8a0';
      ctx.fillRect(cx - w * 0.3, cy - h * 0.5, w * 0.6, h);
      blob(ctx, cx - w * 0.42, cy, w * 0.32, w * 0.32, '#f6c8a0');
      blob(ctx, cx + w * 0.42, cy, w * 0.32, w * 0.32, '#f6c8a0');
      eyes(ctx, cx, cy - h * 0.25, w * 0.12, w * 0.06, true);
      break;
    case 'runner':
      blob(ctx, cx, cy, w, h * 0.8, '#ef4444');
      eyes(ctx, cx, cy - 1, w * 0.2, w * 0.11, true);
      break;
    case 'sniper':
      blob(ctx, cx, cy + 2, w, h * 0.9, '#0f766e');
      eyes(ctx, cx, cy, w * 0.2, w * 0.1, true);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - h * 0.55, w * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'bg':
      break;
    default:
      ctx.font = `${Math.min(w, h)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(ITEM_EMOJI[key as ItemKind], cx, cy);
  }
}

/** 전용 그림이 없는 적이 대신 쓰는 그림(그림도 없으면 도형) */
const SPRITE_FALLBACK: Partial<Record<SpriteKey, SpriteKey>> = { runner: 'swarm', sniper: 'slime' };

function sprite(ctx: CanvasRenderingContext2D, sprites: Sprites, key: SpriteKey, cx: number, cy: number, w: number, h: number): void {
  const fallback = SPRITE_FALLBACK[key];
  const image = sprites[key] ?? (fallback ? sprites[fallback] : undefined);
  if (image) {
    drawImage(ctx, image, cx, cy, w, h);
  } else {
    drawPlaceholder(ctx, key, cx, cy, w, h);
  }
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, w / 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------------------------- 배경과 도로

function drawBackdrop(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const bg = scene.sprites.bg;
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  if (bg) {
    // 지평선 위쪽 하늘·숲: 그림을 꽉 채워 깔고 어둡게 눌러 도로와 게임 요소가 돋보이게 한다
    const scale = Math.max(VIEW.width / bg.naturalWidth, (HORIZON_Y + 80) / bg.naturalHeight);
    const w = bg.naturalWidth * scale;
    const h = bg.naturalHeight * scale;
    ctx.drawImage(bg, (VIEW.width - w) / 2, 0, w, h);
    ctx.fillStyle = 'rgba(8, 15, 30, 0.35)';
    ctx.fillRect(0, 0, VIEW.width, HORIZON_Y + 80);
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const bottomZ = -((VIEW.height - HORIZON_Y) / (PLAYER_Y - HORIZON_Y) - 1) * 420 * PX; // 화면 맨 아래에 해당하는 z
  const farLeft = project(ROAD_LEFT, FIELD.depth * 3);
  const nearLeft = project(ROAD_LEFT, bottomZ);
  const nearRight = project(ROAD_RIGHT, bottomZ);
  const farRight = project(ROAD_RIGHT, FIELD.depth * 3);
  const gradient = ctx.createLinearGradient(0, HORIZON_Y, 0, VIEW.height);
  gradient.addColorStop(0, PALETTE.roadFar);
  gradient.addColorStop(1, PALETTE.road);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(farLeft.x, farLeft.y);
  ctx.lineTo(farRight.x, farRight.y);
  ctx.lineTo(nearRight.x, nearRight.y);
  ctx.lineTo(nearLeft.x, nearLeft.y);
  ctx.closePath();
  ctx.fill();
  // 양옆 난간
  ctx.strokeStyle = PALETTE.rail;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(farLeft.x, farLeft.y);
  ctx.lineTo(nearLeft.x, nearLeft.y);
  ctx.moveTo(farRight.x, farRight.y);
  ctx.lineTo(nearRight.x, nearRight.y);
  ctx.stroke();
  // 차선: 달린 거리만큼 뒤로 흘러간다
  const offset = (scene.state.scroll / PX) % LANE_DASH;
  ctx.strokeStyle = PALETTE.lane;
  for (const lane of Array.from({ length: LANE_COUNT - 1 }, (_, i) => ((i + 1) * VIEW.width) / LANE_COUNT)) {
    for (let z = -offset - LANE_DASH; z < FIELD.depth / PX; z += LANE_DASH) {
      const a = project(lane * PX, Math.max(z, -150) * PX);
      const b = project(lane * PX, Math.max(z + LANE_DASH * 0.45, -150) * PX);
      if (b.y <= a.y && b.y >= HORIZON_Y) {
        ctx.lineWidth = Math.max(1, 4 * a.scale);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------- 물체

function drawGate(ctx: CanvasRenderingContext2D, gate: Gate, tick: number): void {
  const mid = project(FIELD.width / 2, gate.z);
  const height = 62 * mid.scale;
  const bounds = gateBounds(gate, tick);
  gate.zones.forEach((zone, index) => {
    const x0 = project(bounds[index].x0, gate.z).x;
    const x1 = project(bounds[index].x1, gate.z).x;
    const width = x1 - x0;
    const chosen = zone.effect;
    const trap = !zone.hidden && isTrap(chosen.kind);
    ctx.fillStyle = zone.hidden ? PALETTE.gateHidden : trap ? PALETTE.gateTrap : chosen.kind === 'shotsMul' ? PALETTE.gateMul : PALETTE.gateGood;
    ctx.fillRect(x0 + 1.5, mid.y - height, width - 3, height);
    ctx.strokeStyle = zone.hidden ? '#c4b5fd' : trap ? '#f87171' : chosen.kind === 'shotsMul' ? '#facc15' : '#38bdf8';
    ctx.lineWidth = Math.max(1, 3 * mid.scale);
    ctx.strokeRect(x0 + 1.5, mid.y - height, width - 3, height);
    const cx = (x0 + x1) / 2;
    const title = zone.hidden ? HIDDEN_TITLE : pick(GATE_TITLES[chosen.kind], gate.id + index);
    const value = zone.hidden ? HIDDEN_TEXT : gateValueText(chosen.kind, chosen.value);
    // 좁은 칸에도 글자가 들어가도록 칸 폭에 맞춰 줄인다
    const titleSize = Math.max(6, Math.min(13 * mid.scale, width / (title.length * 0.9)));
    const valueSize = Math.max(8, Math.min(26 * mid.scale, width / (value.length * 0.62)));
    text(ctx, title, cx, mid.y - height * 0.74, titleSize, '#e2e8f0', { weight: '600' });
    text(ctx, value, cx, mid.y - height * 0.34, valueSize, trap ? COLORS.trap : '#fff');
  });
}

function drawBoulder(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
  const at = project(enemy.x, enemy.z);
  const radius = (enemy.w / PX / 2) * at.scale;
  const cy = at.y - radius * 0.85;
  shadow(ctx, at.x, at.y, radius * 2);
  const gradient = ctx.createRadialGradient(at.x - radius * 0.35, cy - radius * 0.4, radius * 0.1, at.x, cy, radius);
  gradient.addColorStop(0, '#ffd08a');
  gradient.addColorStop(0.45, '#fb923c');
  gradient.addColorStop(1, '#c2410c');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(at.x, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  // 꼭지와 잎
  ctx.fillStyle = '#4d7c0f';
  ctx.beginPath();
  ctx.ellipse(at.x + radius * 0.12, cy - radius * 0.97, radius * 0.22, radius * 0.11, -0.5, 0, Math.PI * 2);
  ctx.fill();
  if (enemy.flash > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(at.x, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // 체력 숫자: 줄어드는 숫자가 "내 화력과의 승부" 를 보여 준다
  text(ctx, formatCount(enemy.hp), at.x, cy + radius * 0.1, Math.max(10, radius * (formatCount(enemy.hp).length > 5 ? 0.46 : 0.62)), '#fff');
}

function drawActor(ctx: CanvasRenderingContext2D, scene: Scene, enemy: Enemy): void {
  const at = project(enemy.x, enemy.z);
  const key: SpriteKey = enemy.kind === 'brute' ? 'slime' : enemy.kind === 'boss' ? 'boss' : enemy.kind === 'runner' ? 'runner' : enemy.kind === 'sniper' ? 'sniper' : 'swarm';
  const base = enemy.kind === 'brute' ? SIZE.brute : enemy.kind === 'boss' ? enemy.w / PX : enemy.kind === 'sniper' ? SIZE.brute * 0.8 : enemy.kind === 'runner' ? SIZE.grunt * 0.85 : SIZE.grunt;
  const w = base * at.scale;
  const hop = enemy.kind === 'boss' ? 0 : Math.abs(Math.sin((scene.state.tick + enemy.seed) * 0.3)) * 4 * at.scale;
  shadow(ctx, at.x, at.y, w * 0.9);
  ctx.save();
  if (enemy.shielded > 0) {
    ctx.globalAlpha = 0.7;
  }
  sprite(ctx, scene.sprites, key, at.x, at.y - w * 0.5 - hop, w, w);
  if (enemy.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    sprite(ctx, scene.sprites, key, at.x, at.y - w * 0.5 - hop, w, w);
  }
  ctx.restore();
  if (enemy.shielded > 0) {
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(at.x, at.y - w * 0.5, w * 0.6, w * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (enemy.kind === 'brute') {
    text(ctx, formatCount(enemy.hp), at.x, at.y - w * 1.08, Math.max(8, 15 * at.scale), '#fff');
  }
}

function drawSeed(ctx: CanvasRenderingContext2D, x: number, z: number, tick: number): void {
  const at = project(x, z);
  const size = SIZE.dumbbell * 0.6 * at.scale;
  ctx.save();
  ctx.translate(at.x, at.y - size * 0.9);
  ctx.rotate(tick * 0.25);
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.4, size * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fdba74';
  ctx.beginPath();
  ctx.ellipse(-size * 0.1, -size * 0.2, size * 0.12, size * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDumbbell(ctx: CanvasRenderingContext2D, x: number, z: number, tick: number): void {
  const at = project(x, z);
  const size = SIZE.dumbbell * at.scale;
  ctx.save();
  ctx.translate(at.x, at.y - size * 0.6);
  ctx.rotate(tick * 0.2);
  ctx.fillStyle = '#475569';
  ctx.fillRect(-size * 0.1, -size * 0.5, size * 0.2, size);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-size * 0.32, -size * 0.55, size * 0.64, size * 0.22);
  ctx.fillRect(-size * 0.32, size * 0.33, size * 0.64, size * 0.22);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { state } = scene;
  const p = state.player;
  const at = project(p.x, 0);
  const pulse = 1 + Math.sin(state.tick * 0.2) * 0.04;
  // 발밑의 초록 원(내 위치)
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(at.x, at.y, 30, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (p.star > 0) {
    ctx.fillStyle = `rgba(253, 224, 71, ${0.25 + Math.sin(state.tick * 0.3) * 0.1})`;
    ctx.beginPath();
    ctx.arc(at.x, at.y - 30, 40 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  if (p.invuln > 0 && Math.floor(state.tick / 4) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }
  const run = state.over ? 0 : Math.abs(Math.sin(state.tick * 0.35)) * 5;
  sprite(ctx, scene.sprites, 'hero', at.x, at.y - SIZE.hero * 0.5 - run, SIZE.hero, SIZE.hero);
  ctx.restore();
  for (let i = 0; i < p.shield; i += 1) {
    ctx.strokeStyle = i === 0 ? 'rgba(251, 146, 60, 0.95)' : 'rgba(253, 186, 116, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(at.x, at.y - 30, 36 + i * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------------------------- 화면 위 정보

function drawHud(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { state, best } = scene;
  const p = state.player;
  text(ctx, String(state.score), 12, 22, 26, '#fff', { align: 'left' });
  const infinite = isInfinite(state.stage);
  text(ctx, infinite ? `∞ STAGE ${state.stage}` : `STAGE ${state.stage}`, VIEW.width - 12, 18, 15, infinite ? '#fde68a' : '#cbd5e1', { align: 'right' });
  if (infinite) {
    text(ctx, `무한 +${infiniteLevel(state.stage)}`, VIEW.width - 12, 56, 11, '#fca5a5', { align: 'right', weight: '600' });
  }
  if (best !== null) {
    text(ctx, `BEST ${best}`, VIEW.width - 12, 38, 12, '#94a3b8', { align: 'right', weight: '600' });
  }
  if (state.combo >= 3) {
    text(ctx, `COMBO ${state.combo}  ×${comboMultiplier(state.combo)}`, 12, 48, 13, COLORS.gold, { align: 'left' });
  }
  // 내 화력: 화면의 체력 숫자와 견주는 기준
  text(ctx, `화력 ${formatCount(firepower(p))}`, 12, VIEW.height - 30, 22, '#86efac', { align: 'left' });
  text(ctx, `${p.shots}발 × 공격 ${formatCount(p.damage)}`, 12, VIEW.height - 12, 11, '#cbd5e1', { align: 'left', weight: '600' });
  // 이 스테이지에서 낼 수 있는 최대 화력: 상한이 스테이지와 함께 올라가는 것이 성장의 기준선이다
  text(ctx, `한계 ${formatCount(firepowerCap(state.stage))}`, 12, VIEW.height - 52, 11, '#fde68a', { align: 'left', weight: '600' });
  const icons: [string, number, number][] = [
    ['🍗', p.chicken, 360],
    ['💰', p.cash, 480],
    ['⭐', p.star, 300],
    ['🎯', p.pierce, 600],
  ];
  let x = VIEW.width - 12;
  for (const [emoji, ticks, max] of icons) {
    if (ticks <= 0) {
      continue;
    }
    ctx.font = `18px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(emoji, x, VIEW.height - 28);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(x - 22, VIEW.height - 16, 22, 3);
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x - 22, VIEW.height - 16, (22 * Math.min(ticks, max)) / max, 3);
    x -= 34;
  }
  const boss = state.enemies.find((e) => e.kind === 'boss');
  if (boss) {
    const w = VIEW.width - 80;
    ctx.fillStyle = PALETTE.hpBack;
    ctx.fillRect(40, 62, w, 12);
    ctx.fillStyle = boss.shielded > 0 ? '#fde047' : PALETTE.hpFill;
    ctx.fillRect(40, 62, (w * Math.max(0, boss.hp)) / boss.maxHp, 12);
    text(ctx, `${BOSS_NAME}  ${formatCount(boss.hp)}`, VIEW.width / 2, 90, 15, '#fff');
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
    text(ctx, '귤 폭격', VIEW.width / 2, 190, 42, COLORS.orange);
    text(ctx, '도로롱', VIEW.width / 2, 238, 42, '#f9a8d4');
    text(ctx, scene.touch ? '화면을 좌우로 끌어서 움직여요' : '← → 또는 A D 로 움직여요', VIEW.width / 2, 312, 15, '#e2e8f0', { weight: '600' });
    text(ctx, '총알은 알아서 나가요', VIEW.width / 2, 338, 15, '#e2e8f0', { weight: '600' });
    text(ctx, '내 화력보다 큰 숫자는 피하고, 작은 숫자는 쏴서 부숴요', VIEW.width / 2, 366, 12, '#fde68a', { weight: '600' });
    text(ctx, '한 번 맞으면 끝! 귤이 있으면 한 번은 막아요', VIEW.width / 2, 388, 12, '#fca5a5', { weight: '600' });
    text(ctx, scene.touch ? '탭해서 시작' : '스페이스 · 클릭으로 시작', VIEW.width / 2, 440, 20, '#fff');
    text(ctx, `TIP  ${scene.tip}`, VIEW.width / 2, 530, 12, '#94a3b8', { weight: '600' });
    return;
  }
  text(ctx, 'GAME OVER', VIEW.width / 2, 180, 36, '#fca5a5');
  text(ctx, scene.overLine, VIEW.width / 2, 226, 16, '#e2e8f0', { weight: '600' });
  text(ctx, String(state.score), VIEW.width / 2, 292, 46, '#fff');
  text(ctx, rankTitle(state.score), VIEW.width / 2, 340, 20, COLORS.gold);
  text(ctx, `STAGE ${state.stage} · 처치 ${state.kills}`, VIEW.width / 2, 376, 14, '#cbd5e1', { weight: '600' });
  text(ctx, scene.touch ? '탭해서 다시 시작' : '스페이스 · 클릭으로 다시 시작', VIEW.width / 2, 440, 18, '#fff');
}

/** 위험한 줄을 붉게 깜빡이고 경고 문구를 띄운다. 큰 위험(러시·보스)에는 화면 가장자리도 붉게. */
function drawWarnings(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { fx, state } = scene;
  const pulse = 0.5 + 0.5 * Math.sin(state.tick * 0.5);
  fx.warnings.forEach((warning, index) => {
    const fade = Math.min(1, (warning.life - warning.age) / 20);
    if (warning.lane !== null) {
      const near = -60 * PX;
      const x0 = warning.lane * LANE_WIDTH;
      const x1 = x0 + LANE_WIDTH;
      const a = project(x0, FIELD.depth);
      const b = project(x1, FIELD.depth);
      const c = project(x1, near);
      const d = project(x0, near);
      ctx.fillStyle = `rgba(239, 68, 68, ${(0.12 + pulse * 0.2) * fade})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.save();
    ctx.globalAlpha = fade;
    text(ctx, warning.text, VIEW.width / 2, 112 + index * 22, 15, pulse > 0.5 ? '#fecaca' : '#fca5a5');
    ctx.restore();
  });
  if (fx.alarm > 0) {
    const strength = Math.min(1, fx.alarm / 40) * (0.25 + pulse * 0.35);
    const edge = 26;
    ctx.fillStyle = `rgba(239, 68, 68, ${strength})`;
    ctx.fillRect(0, 0, VIEW.width, edge);
    ctx.fillRect(0, VIEW.height - edge, VIEW.width, edge);
    ctx.fillRect(0, 0, edge, VIEW.height);
    ctx.fillRect(VIEW.width - edge, 0, edge, VIEW.height);
    if (state.bossActive && !state.enemies.some((e) => e.kind === 'boss' && e.z <= 34000)) {
      text(ctx, WARN_BOSS, VIEW.width / 2, 140, 28, pulse > 0.5 ? '#fff' : '#fca5a5');
    }
  }
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
  text(ctx, banner.title, VIEW.width / 2, big ? 170 : 150, big ? 30 : 26, big ? COLORS.orange : '#e2e8f0');
  if (big) {
    text(ctx, `"${banner.sub}"`, VIEW.width / 2, 206, 16, '#fff', { weight: '600' });
  }
  ctx.restore();
}

type Drawable = { z: number; draw: () => void };

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { state, fx } = scene;
  ctx.save();
  if (fx.shake > 0) {
    const m = fx.shake * 0.5;
    ctx.translate(Math.sin(state.tick * 7) * m, Math.cos(state.tick * 9) * m);
  }
  drawBackdrop(ctx, scene);
  drawRoad(ctx, scene);

  // 먼 것부터 그린다(가까운 것이 먼 것을 가린다)
  const drawables: Drawable[] = [];
  state.gates.forEach((gate) => drawables.push({ z: gate.z, draw: () => drawGate(ctx, gate, state.tick) }));
  state.items.forEach((item) =>
    drawables.push({
      z: item.z,
      draw: () => {
        const at = project(item.x, item.z);
        const size = SIZE.item * at.scale;
        const bob = Math.sin((state.tick + item.id * 7) * 0.15) * 3 * at.scale;
        shadow(ctx, at.x, at.y, size);
        sprite(ctx, scene.sprites, item.kind, at.x, at.y - size * 0.7 + bob, size, size);
      },
    }),
  );
  state.enemies.forEach((enemy) => drawables.push({ z: enemy.z, draw: () => (enemy.kind === 'boulder' ? drawBoulder(ctx, enemy) : drawActor(ctx, scene, enemy)) }));
  state.dumbbells.forEach((d) => drawables.push({ z: d.z, draw: () => (d.style === 'seed' ? drawSeed(ctx, d.x, d.z, state.tick) : drawDumbbell(ctx, d.x, d.z, state.tick)) }));
  state.bullets.forEach((bullet) =>
    drawables.push({
      z: bullet.z,
      draw: () => {
        const at = project(bullet.x, bullet.z);
        ctx.fillStyle = bullet.pierce > 0 ? '#fde047' : '#fb923c';
        ctx.beginPath();
        ctx.ellipse(at.x, at.y - 22 * at.scale, SIZE.bullet * 0.7 * at.scale, SIZE.bullet * at.scale, 0, 0, Math.PI * 2);
        ctx.fill();
      },
    }),
  );
  drawables.sort((a, b) => b.z - a.z).forEach((d) => d.draw());

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
  drawWarnings(ctx, scene);
  drawBanner(ctx, scene);
  ctx.restore();
  drawOverlay(ctx, scene);
}
