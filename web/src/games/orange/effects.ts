import { PX, type EnemyKind, type GameEvent } from './engine';
import { BOSS_DOWN, BOSS_INTRO, BOSS_NAME, BOSS_SHIELD, GATE_TITLES, gateValueText, isTrap, pick, quipFor } from './jokes';

/** 화면 효과(말풍선, 반짝임, 흔들림). 게임 규칙과 무관하고 엔진의 난수도 쓰지 않는다. 좌표는 px 이다. */

export interface FloatText {
  text: string;
  x: number;
  y: number;
  age: number;
  life: number;
  color: string;
  size: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
  radius: number;
}

export interface Banner {
  title: string;
  sub: string;
  age: number;
  life: number;
}

export interface Effects {
  texts: FloatText[];
  particles: Particle[];
  shake: number;
  banner: Banner | null;
}

export const COLORS = {
  good: '#86efac',
  trap: '#fca5a5',
  gold: '#fde047',
  orange: '#fb923c',
  white: '#f8fafc',
} as const;

const MAX_TEXTS = 14;
const MAX_PARTICLES = 160;
const TEXT_RISE = 0.6;
const GRAVITY = 0.12;

const KIND_COLORS: Record<EnemyKind, string> = {
  swarm: '#94a3b8',
  mini: '#86efac',
  slime: '#4ade80',
  wall: '#d6a36a',
  elite: '#c084fc',
  boss: '#fb923c',
};

export function createEffects(): Effects {
  return { texts: [], particles: [], shake: 0, banner: null };
}

function addText(fx: Effects, text: string, x: number, y: number, color: string, size = 15, life = 50): void {
  fx.texts.push({ text, x, y, age: 0, life, color, size });
  if (fx.texts.length > MAX_TEXTS) {
    fx.texts.shift();
  }
}

function burst(fx: Effects, x: number, y: number, color: string, count: number, rnd: () => number, speed = 2.4): void {
  for (let i = 0; i < count; i += 1) {
    const angle = rnd() * Math.PI * 2;
    const v = (0.4 + rnd() * 0.6) * speed;
    fx.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 0.6, age: 0, life: 24 + Math.floor(rnd() * 16), color, radius: 1.5 + rnd() * 2.5 });
  }
  while (fx.particles.length > MAX_PARTICLES) {
    fx.particles.shift();
  }
}

/** 엔진 이벤트를 화면 효과로 바꾼다. rnd 는 0 이상 1 미만의 연출용 난수. */
export function applyEvent(fx: Effects, event: GameEvent, rnd: () => number): void {
  const pickIndex = Math.floor(rnd() * 1000);
  const quip = quipFor(event, pickIndex);
  switch (event.t) {
    case 'kill': {
      const x = event.x / PX;
      const y = event.y / PX;
      burst(fx, x, y, KIND_COLORS[event.kind], event.kind === 'boss' ? 40 : 7, rnd);
      if (quip) {
        addText(fx, quip, x, y - 10, COLORS.white);
      }
      if (event.points >= 100 && event.kind !== 'boss') {
        addText(fx, `+${event.points}`, x, y + 6, COLORS.gold, 13);
      }
      break;
    }
    case 'gate': {
      const x = event.x / PX;
      const y = event.y / PX;
      const trap = isTrap(event.kind);
      addText(fx, pick(GATE_TITLES[event.kind], pickIndex), x, y - 52, trap ? COLORS.trap : COLORS.good, 15, 60);
      addText(fx, gateValueText(event.kind, event.value), x, y - 32, trap ? COLORS.trap : COLORS.good, 20, 60);
      burst(fx, x, y, trap ? '#f87171' : '#4ade80', 14, rnd);
      break;
    }
    case 'item': {
      burst(fx, event.x / PX, event.y / PX, COLORS.gold, 10, rnd);
      if (quip) {
        addText(fx, quip, event.x / PX, event.y / PX - 20, COLORS.gold, 16, 60);
      }
      break;
    }
    case 'shieldBreak': {
      fx.shake = 12;
      burst(fx, event.x / PX, event.y / PX, COLORS.orange, 20, rnd, 3.2);
      if (quip) {
        addText(fx, quip, event.x / PX, event.y / PX - 40, COLORS.orange, 17, 70);
      }
      break;
    }
    case 'wave':
      if (event.n > 1 && event.n % 10 !== 0) {
        fx.banner = { title: `WAVE ${event.n}`, sub: '', age: 0, life: 70 };
      }
      break;
    case 'bossIntro':
      fx.shake = 14;
      fx.banner = { title: BOSS_NAME, sub: pick(BOSS_INTRO, pickIndex), age: 0, life: 150 };
      break;
    case 'bossShield':
      if (event.on) {
        addText(fx, pick(BOSS_SHIELD, pickIndex), 180, 70, COLORS.orange, 18, 80);
      }
      break;
    case 'bossDown':
      fx.shake = 22;
      burst(fx, event.x / PX, event.y / PX, COLORS.orange, 60, rnd, 4);
      fx.banner = { title: `${BOSS_NAME} 격파!`, sub: pick(BOSS_DOWN, pickIndex), age: 0, life: 170 };
      break;
    case 'over':
      fx.shake = 18;
      break;
  }
}

/** 한 프레임만큼 효과를 진행한다. */
export function updateEffects(fx: Effects): void {
  for (const text of fx.texts) {
    text.age += 1;
    text.y -= TEXT_RISE;
  }
  fx.texts = fx.texts.filter((t) => t.age < t.life);
  for (const p of fx.particles) {
    p.age += 1;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY;
  }
  fx.particles = fx.particles.filter((p) => p.age < p.life);
  if (fx.shake > 0) {
    fx.shake -= 1;
  }
  if (fx.banner) {
    fx.banner.age += 1;
    if (fx.banner.age >= fx.banner.life) {
      fx.banner = null;
    }
  }
}
