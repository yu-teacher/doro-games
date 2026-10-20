import { describe, expect, it } from 'vitest';
import { canAfford, maxBuyHint, projectOranges } from './live';

const base = { oranges: 100, ratePerSecond: 5, tapPower: 3, orangeCap: 9_000_000_000_000_000 };

describe('귤 수 화면 계산', () => {
  it('시간이 흐른 만큼 생산이 더해진다(정수, 내림)', () => {
    expect(projectOranges(base, 1000, 1000, 0)).toBe(100);
    expect(projectOranges(base, 1000, 3000, 0)).toBe(110);
    expect(projectOranges(base, 1000, 1300, 0)).toBe(101); // 5/s × 0.3s = 1.5 → 1
  });

  it('아직 서버에 보내지 않은 탭도 보여 준다', () => {
    expect(projectOranges(base, 0, 0, 4)).toBe(112);
    expect(projectOranges(base, 0, 0, -3)).toBe(100);
  });

  it('시계가 거꾸로 가도 줄지 않고, 서버 한도를 넘지 않는다', () => {
    expect(projectOranges(base, 5000, 1000, 0)).toBe(100);
    const near = { ...base, oranges: base.orangeCap - 2 };
    expect(projectOranges(near, 0, 60_000, 10)).toBe(base.orangeCap);
  });

  it('비용을 낼 수 있는지와 살 수 있는 횟수 힌트', () => {
    expect(canAfford(15, 15)).toBe(true);
    expect(canAfford(16, 15)).toBe(false);
    expect(canAfford(Number.NaN, 100)).toBe(false);
    expect(maxBuyHint(15, 100, 10)).toBe(6);
    expect(maxBuyHint(15, 1000, 10)).toBe(10);
    expect(maxBuyHint(0, 1000, 10)).toBe(0);
  });
});
