import { describe, expect, it } from 'vitest';
import { soundFor, tempoFor, voiceFor } from './audio';
import type { GameEvent } from './engine';

describe('이벤트 → 소리', () => {
  it('좋은 칸과 나쁜 칸은 다른 소리다', () => {
    const good: GameEvent = { t: 'gate', kind: 'shotsUp', value: 2, x: 0 };
    const bad: GameEvent = { t: 'gate', kind: 'shotsDown', value: 2, x: 0 };
    expect(soundFor(good)).toBe('good');
    expect(soundFor(bad)).toBe('bad');
    expect(voiceFor(bad)).toBeNull();
  });

  it('보스 처치는 일반 처치음 대신 전용 소리를 낸다', () => {
    expect(soundFor({ t: 'kill', kind: 'boss', x: 0, z: 0, points: 1 })).toBeNull();
    expect(soundFor({ t: 'bossDown', x: 0, z: 0, index: 1 })).toBe('bossKill');
    expect(soundFor({ t: 'kill', kind: 'grunt', x: 0, z: 0, points: 1 })).toBe('kill');
  });

  it('소리가 없는 이벤트도 있다', () => {
    expect(soundFor({ t: 'bossShield', on: true, index: 1 })).toBeNull();
  });

  it('말하는 확률은 0~100 이고 판이 끝나면 반드시 말한다', () => {
    expect(voiceFor({ t: 'over', cause: 'touch' })).toEqual({ voice: 'sigh', chance: 100 });
    for (const event of [{ t: 'item', kind: 'orange', x: 0 }, { t: 'stage', n: 2 }] as GameEvent[]) {
      const v = voiceFor(event);
      expect(v && v.chance > 0 && v.chance <= 100).toBe(true);
    }
  });

  it('배경음은 스테이지가 오르고 보스·무한 모드에서 빨라진다', () => {
    expect(tempoFor(50, false, false)).toBeGreaterThan(tempoFor(1, false, false));
    expect(tempoFor(10, true, false)).toBeGreaterThan(tempoFor(10, false, false));
    expect(tempoFor(100, false, true)).toBeGreaterThan(tempoFor(100, false, false));
    expect(tempoFor(5000, false, false)).toBe(tempoFor(100, false, false));
  });
});
