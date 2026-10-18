import { beforeEach, describe, expect, it } from 'vitest';
import { loadHero, saveHero } from './hero';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
  });
});

describe('시작 캐릭터 저장', () => {
  it('저장한 번호를 다시 읽는다', () => {
    saveHero(3);
    expect(loadHero(12)).toBe(3);
  });

  it('저장이 없거나 범위를 벗어나거나 이상한 값이면 0번이다', () => {
    expect(loadHero(12)).toBe(0);
    saveHero(20);
    expect(loadHero(12)).toBe(0);
    store.set('doro-games.orange.hero', 'abc');
    expect(loadHero(12)).toBe(0);
    store.set('doro-games.orange.hero', '-1');
    expect(loadHero(12)).toBe(0);
  });

  it('저장소가 막혀 있어도 오류 없이 0번이다', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    expect(loadHero(5)).toBe(0);
    expect(() => saveHero(2)).not.toThrow();
  });
});
