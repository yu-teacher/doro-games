import { describe, expect, it } from 'vitest';
import { residentCount } from './residents';

describe('농장에 나오는 도로롱 수', () => {
  it('레벨이 오를수록 늘어나고 한 종류에 4마리를 넘지 않는다', () => {
    expect(residentCount(0)).toBe(0);
    expect(residentCount(-3)).toBe(0);
    expect(residentCount(1)).toBe(1);
    let previous = 0;
    for (let level = 1; level <= 600; level += 1) {
      const n = residentCount(level);
      expect(n).toBeGreaterThanOrEqual(previous);
      expect(n).toBeLessThanOrEqual(4);
      previous = n;
    }
    expect(residentCount(500)).toBe(4);
  });
});
