import { useEffect, useRef } from 'react';
import { residentCount } from './residents';

const W = 420;
const H = 190;
const GROUND_TOP = 96;
interface Resident {
  key: string;
  index: number;
  x: number;
  lane: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  /** 뛰어오르기(탭)의 높이와 속도 */
  hopY: number;
  hopV: number;
  nextPopAt: number;
}

interface Pop {
  x: number;
  y: number;
  born: number;
}

interface FieldProps {
  /** 종류별 레벨(도로롱 종류 순서) */
  levels: readonly number[];
  /** 종류별 그림(없으면 귤 이모지) */
  images: readonly (HTMLImageElement | undefined)[];
  background?: HTMLImageElement;
  /** 값이 바뀔 때마다 도로롱들이 한 번 뛰어오른다(귤을 딸 때) */
  hop: number;
}

/**
 * 농장 풍경. 사들인 도로롱들이 풀밭을 돌아다니며 귤을 따고, 귤을 딸 때마다 폴짝 뛴다(보는 맛).
 * 게임 값과는 상관없는 연출이라 서버 값과 어긋나도 괜찮다(레벨에서 나온 마릿수만 따른다).
 */
export default function FarmField({ levels, images, background, hop }: FieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const residentsRef = useRef<Resident[]>([]);
  const popsRef = useRef<Pop[]>([]);
  const propsRef = useRef({ images, background, hop });
  const lastHopRef = useRef(hop);

  useEffect(() => {
    propsRef.current = { images, background, hop };
  }, [images, background, hop]);

  // 레벨이 바뀌면 도로롱 목록을 맞춘다(있던 아이는 그대로 두고 모자란 만큼만 새로 세운다)
  useEffect(() => {
    const wanted = new Set<string>();
    const list = residentsRef.current;
    levels.forEach((level, index) => {
      for (let k = 0; k < residentCount(level); k += 1) {
        const key = `${index}-${k}`;
        wanted.add(key);
        if (!list.some((r) => r.key === key)) {
          const seed = index * 7 + k * 13;
          list.push({
            key,
            index,
            x: 30 + ((seed * 53) % (W - 60)),
            lane: ((seed * 29) % 70) + 10,
            dir: seed % 2 === 0 ? 1 : -1,
            speed: 8 + ((seed * 11) % 14),
            phase: seed,
            hopY: 0,
            hopV: 0,
            nextPopAt: performance.now() + 800 + ((seed * 97) % 2500),
          });
        }
      }
    });
    residentsRef.current = list.filter((r) => wanted.has(r.key));
  }, [levels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      return undefined;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let frameId = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { images: imgs, background: bg, hop: hopNow } = propsRef.current;
      const residents = residentsRef.current;
      if (hopNow !== lastHopRef.current) {
        lastHopRef.current = hopNow;
        residents.forEach((r) => {
          if (r.hopY <= 0.5) {
            r.hopV = 150 + (r.phase % 5) * 12;
          }
        });
      }

      // 배경: 그림이 있으면 어둡게 깔고, 없으면 하늘과 풀밭
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_TOP);
      sky.addColorStop(0, '#7dd3fc');
      sky.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      if (bg) {
        const scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
        ctx.drawImage(bg, (W - bg.naturalWidth * scale) / 2, 0, bg.naturalWidth * scale, bg.naturalHeight * scale);
        ctx.fillStyle = 'rgba(8, 15, 30, 0.18)';
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(0, GROUND_TOP, W, H - GROUND_TOP);
      }

      // 먼 쪽(위)부터 그린다
      const sorted = [...residents].sort((a, b) => a.lane - b.lane);
      for (const r of sorted) {
        r.x += r.dir * r.speed * dt;
        if (r.x < 24) {
          r.dir = 1;
        } else if (r.x > W - 24) {
          r.dir = -1;
        }
        r.hopV -= 520 * dt;
        r.hopY = Math.max(0, r.hopY + r.hopV * dt);
        if (r.hopY === 0 && r.hopV < 0) {
          r.hopV = 0;
        }
        const y = GROUND_TOP + 22 + r.lane;
        const depthScale = 0.8 + (r.lane / 80) * 0.35;
        const size = 54 * depthScale;
        const bob = Math.abs(Math.sin(now / 220 + r.phase)) * 3;
        const img = imgs[r.index];
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(r.x, y, size * 0.32, size * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(r.x, y - r.hopY - bob);
        if (r.dir < 0) {
          ctx.scale(-1, 1);
        }
        if (img) {
          const fit = Math.min(size / img.naturalWidth, size / img.naturalHeight);
          ctx.drawImage(img, (-img.naturalWidth * fit) / 2, -img.naturalHeight * fit, img.naturalWidth * fit, img.naturalHeight * fit);
        } else {
          ctx.font = `${size * 0.7}px system-ui`;
          ctx.textAlign = 'center';
          ctx.fillText('🍊', 0, -size * 0.1);
        }
        ctx.restore();
        // 가끔 귤을 하나 딴다
        if (now >= r.nextPopAt) {
          r.nextPopAt = now + 1800 + ((r.phase * 131) % 2600);
          popsRef.current.push({ x: r.x, y: y - size - 4, born: now });
          if (popsRef.current.length > 30) {
            popsRef.current.shift();
          }
        }
      }

      popsRef.current = popsRef.current.filter((p) => now - p.born < 900);
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      for (const p of popsRef.current) {
        const t = (now - p.born) / 900;
        ctx.globalAlpha = 1 - t;
        ctx.fillText('🍊', p.x, p.y - t * 28);
      }
      ctx.globalAlpha = 1;
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="block w-full rounded-2xl border border-slate-700" style={{ aspectRatio: `${W} / ${H}` }} />;
}
