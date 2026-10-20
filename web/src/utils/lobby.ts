import type { GameCategory, GameHighlight } from '../api/types';

/** 로비의 구역 순서와 이름 */
export const LOBBY_SECTIONS: readonly { category: GameCategory; title: string; blurb: string }[] = [
  { category: 'minigame', title: '미니게임', blurb: '한 판씩 점수를 겨뤄요' },
  { category: 'longplay', title: '오래 즐기는 게임', blurb: '진행 상황이 저장되고 계속 이어져요' },
];

/**
 * 게임을 구역별로 나눈다. 구역 안의 순서는 서버가 준 순서를 지키고, 게임이 없는 구역은 빼며,
 * 모르는 종류(서버가 먼저 새 종류를 내보낸 경우)는 미니게임으로 본다(게임이 로비에서 사라지지 않게).
 */
export function groupGames(games: readonly GameHighlight[]): { category: GameCategory; title: string; blurb: string; games: GameHighlight[] }[] {
  const known = new Set<string>(LOBBY_SECTIONS.map((s) => s.category));
  return LOBBY_SECTIONS.map((section) => ({
    ...section,
    games: games.filter((g) => (known.has(g.category) ? g.category : 'minigame') === section.category),
  })).filter((section) => section.games.length > 0);
}
