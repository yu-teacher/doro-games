import { describe, expect, it } from 'vitest';
import { applyEvent, createEffects, updateEffects } from './effects';

const rnd = () => 0.25;

describe('화면 효과', () => {
  it('처치하면 파티클이 생기고, 덩치는 한마디 하며 점수도 띄운다', () => {
    const fx = createEffects();
    applyEvent(fx, { t: 'kill', kind: 'brute', x: 18000, z: 30000, points: 200 }, rnd);
    expect(fx.particles.length).toBeGreaterThan(0);
    expect(fx.texts.map((t) => t.text).join(' ')).toContain('+200');
    expect(fx.texts.length).toBe(2);
  });

  it('보스 등장은 배너와 흔들림, 격파는 배너와 큰 흔들림', () => {
    const fx = createEffects();
    applyEvent(fx, { t: 'bossIntro' }, rnd);
    expect(fx.banner?.title).toBe('근육 도로롱');
    expect(fx.shake).toBeGreaterThan(0);
    applyEvent(fx, { t: 'bossDown', x: 18000, z: 34000 }, rnd);
    expect(fx.banner?.title).toContain('격파');
    expect(fx.shake).toBeGreaterThanOrEqual(20);
  });

  it('함정 게이트는 붉은 글씨, 이로운 게이트는 초록 글씨', () => {
    const trap = createEffects();
    applyEvent(trap, { t: 'gate', kind: 'shotsDown', value: 2, x: 0 }, rnd);
    const good = createEffects();
    applyEvent(good, { t: 'gate', kind: 'shotsUp', value: 2, x: 0 }, rnd);
    expect(trap.texts[0].color).not.toBe(good.texts[0].color);
  });

  it('시간이 지나면 말풍선·파티클·배너가 사라진다', () => {
    const fx = createEffects();
    applyEvent(fx, { t: 'kill', kind: 'brute', x: 0, z: 0, points: 200 }, rnd);
    applyEvent(fx, { t: 'bossIntro' }, rnd);
    for (let i = 0; i < 400; i += 1) {
      updateEffects(fx);
    }
    expect(fx.texts).toHaveLength(0);
    expect(fx.particles).toHaveLength(0);
    expect(fx.banner).toBeNull();
    expect(fx.shake).toBe(0);
  });

  it('말풍선과 파티클은 상한을 넘지 않는다(오래 해도 느려지지 않게)', () => {
    const fx = createEffects();
    for (let i = 0; i < 500; i += 1) {
      applyEvent(fx, { t: 'kill', kind: 'brute', x: 0, z: 0, points: 200 }, rnd);
    }
    expect(fx.texts.length).toBeLessThanOrEqual(14);
    expect(fx.particles.length).toBeLessThanOrEqual(160);
  });

  it('맞힐 때마다 불꽃이 튀지만 피해 숫자는 몇 틱에 한 번만 뜬다', () => {
    const fx = createEffects();
    for (let i = 0; i < 5; i += 1) {
      applyEvent(fx, { t: 'hit', kind: 'grunt', x: 18000, z: 30000, damage: 12 }, rnd);
    }
    expect(fx.particles.length).toBeGreaterThan(0);
    expect(fx.texts.length).toBe(1);
    for (let i = 0; i < 10; i += 1) {
      updateEffects(fx);
    }
    applyEvent(fx, { t: 'hit', kind: 'grunt', x: 18000, z: 30000, damage: 12 }, rnd);
    expect(fx.texts.filter((t) => t.text === '12').length).toBeGreaterThanOrEqual(1);
  });
});
