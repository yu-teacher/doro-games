import { describe, expect, it } from 'vitest';
import type { GameHighlight } from '../api/types';
import { groupGames } from './lobby';

const game = (slug: string, category: string): GameHighlight =>
  ({ slug, title: slug, description: '', category, topScore: null, topNickname: null, myBest: null, myRank: null }) as GameHighlight;

describe('로비 구역 나누기', () => {
  it('미니게임과 오래 즐기는 게임으로 나누고 서버가 준 순서를 지킨다', () => {
    const sections = groupGames([game('runner', 'minigame'), game('farm', 'longplay'), game('2048', 'minigame')]);
    expect(sections.map((s) => s.category)).toEqual(['minigame', 'longplay']);
    expect(sections[0].games.map((g) => g.slug)).toEqual(['runner', '2048']);
    expect(sections[1].games.map((g) => g.slug)).toEqual(['farm']);
  });

  it('게임이 없는 구역은 나오지 않는다', () => {
    expect(groupGames([game('farm', 'longplay')]).map((s) => s.category)).toEqual(['longplay']);
    expect(groupGames([])).toEqual([]);
  });

  it('모르는 종류의 게임도 로비에서 사라지지 않는다(미니게임으로 본다)', () => {
    const sections = groupGames([game('x', 'future-kind')]);
    expect(sections).toHaveLength(1);
    expect(sections[0].category).toBe('minigame');
    expect(sections[0].games[0].slug).toBe('x');
  });
});
