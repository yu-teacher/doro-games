/**
 * 화면에 보이는 큰 숫자를 읽기 쉽게 줄인다. 체력이 수십만, 화력이 수만이 되어도 귤 덩어리 위에 다 들어가도록
 * 1만 이상은 "만", 1억 이상은 "억", 1조 이상은 "조", 1경 이상은 "경" 단위로 보여 준다(점수처럼 정확한 값이 필요한 곳에는 쓰지 않는다).
 */
const MAN = 10_000;
const EOK = 100_000_000;
const JO = 1_000_000_000_000;
const GYEONG = 10_000_000_000_000_000;

function trimmed(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, '');
}

export function formatCount(n: number): string {
  const value = Math.max(0, Math.floor(n));
  if (value < MAN) {
    return String(value);
  }
  if (value < EOK) {
    return `${trimmed(value / MAN, value < 100 * MAN ? 1 : 0)}만`;
  }
  if (value < JO) {
    return `${trimmed(value / EOK, value < 100 * EOK ? 1 : 0)}억`;
  }
  if (value < GYEONG) {
    return `${trimmed(value / JO, value < 100 * JO ? 1 : 0)}조`;
  }
  return `${trimmed(value / GYEONG, value < 100 * GYEONG ? 1 : 0)}경`;
}
