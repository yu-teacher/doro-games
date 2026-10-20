import { describe, expect, it } from 'vitest';
import { TILE_NAMES, tileLevel, tileValue } from './theme';

describe('도로롱 2048 단계', () => {
  it('2 부터 2048 까지 11단계이고 값과 단계가 서로 맞는다', () => {
    expect(TILE_NAMES).toHaveLength(11);
    expect(tileLevel(2)).toBe(0);
    expect(tileLevel(4)).toBe(1);
    expect(tileLevel(2048)).toBe(10);
    for (let level = 0; level < TILE_NAMES.length; level += 1) {
      expect(tileLevel(tileValue(level))).toBe(level);
    }
  });

  it('2048 을 넘거나 이상한 값도 오류 없이 처리한다', () => {
    expect(tileLevel(4096)).toBe(10);
    expect(tileLevel(1 << 20)).toBe(10);
    expect(tileLevel(0)).toBe(0);
    expect(tileLevel(-8)).toBe(0);
    expect(tileLevel(2.5)).toBe(0);
  });

  it('이름은 모두 다르다', () => {
    expect(new Set(TILE_NAMES).size).toBe(TILE_NAMES.length);
  });
});
