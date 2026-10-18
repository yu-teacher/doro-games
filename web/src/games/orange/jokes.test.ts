import { describe, expect, it } from 'vitest';
import { GATE_TITLES, RANKS, gateValueText, isTrap, pick, quipFor, rankTitle } from './jokes';

describe('pick', () => {
  it('번호로 고르고 범위를 벗어나거나 음수여도 돌려 쓴다', () => {
    expect(pick(['a', 'b', 'c'], 0)).toBe('a');
    expect(pick(['a', 'b', 'c'], 4)).toBe('b');
    expect(pick(['a', 'b', 'c'], -1)).toBe('c');
  });
});

describe('게이트 표기', () => {
  it('종류별 값 표기와 함정 구분', () => {
    expect(gateValueText('shotsUp', 4)).toBe('+4');
    expect(gateValueText('shotsMul', 2)).toBe('×2');
    expect(gateValueText('shotsHalf', 2)).toBe('÷2');
    expect(isTrap('shotsDown')).toBe(true);
    expect(isTrap('shotsMul')).toBe(false);
  });

  it('모든 게이트 종류에 이름이 있다', () => {
    (Object.keys(GATE_TITLES) as (keyof typeof GATE_TITLES)[]).forEach((kind) => {
      expect(GATE_TITLES[kind].length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('칭호', () => {
  it('점수가 오를수록 높은 칭호를 받는다', () => {
    expect(rankTitle(0)).toBe(RANKS[0].title);
    expect(rankTitle(999)).toBe(RANKS[0].title);
    expect(rankTitle(1000)).toBe(RANKS[1].title);
    expect(rankTitle(10_000_000)).toBe(RANKS[RANKS.length - 1].title);
  });

  it('기준 점수는 오름차순이다', () => {
    for (let i = 1; i < RANKS.length; i += 1) {
      expect(RANKS[i].from).toBeGreaterThan(RANKS[i - 1].from);
    }
  });
});

describe('quipFor', () => {
  it('아이템·보호막·엘리트·슬라임에는 대사가 있고 보스 처치는 따로 다룬다', () => {
    expect(quipFor({ t: 'item', kind: 'orange', x: 0, y: 0 }, 0)).not.toBeNull();
    expect(quipFor({ t: 'shieldBreak', x: 0, y: 0 }, 0)).not.toBeNull();
    expect(quipFor({ t: 'kill', kind: 'elite', x: 0, y: 0, points: 1 }, 0)).not.toBeNull();
    expect(quipFor({ t: 'kill', kind: 'slime', x: 0, y: 0, points: 1 }, 0)).not.toBeNull();
    expect(quipFor({ t: 'kill', kind: 'boss', x: 0, y: 0, points: 1 }, 0)).toBeNull();
  });

  it('보통 적은 가끔만 한마디 한다(화면이 말풍선으로 가득 차지 않게)', () => {
    const spoken = [0, 1, 2, 3, 4, 5].filter((i) => quipFor({ t: 'kill', kind: 'swarm', x: 0, y: 0, points: 1 }, i) !== null);
    expect(spoken.length).toBeLessThan(6);
    expect(spoken.length).toBeGreaterThan(0);
  });
});
