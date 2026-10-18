/** 시작 캐릭터 선택. 고른 번호는 이 브라우저에만 저장한다(저장이 막힌 환경에서는 이번 방문에만 적용). */
const KEY = 'doro-games.orange.hero';

export function loadHero(count: number): number {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isInteger(value) && value >= 0 && value < Math.max(1, count) ? value : 0;
  } catch {
    return 0;
  }
}

export function saveHero(index: number): void {
  try {
    localStorage.setItem(KEY, String(index));
  } catch {
    // 저장 실패는 무시한다
  }
}
