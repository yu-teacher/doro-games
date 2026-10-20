/** 한 종류당 농장에 나오는 도로롱 수(레벨이 오를수록 늘어난다, 최대 4마리) */
export function residentCount(level: number): number {
  return level <= 0 ? 0 : Math.min(4, 1 + Math.floor(Math.log2(level) / 1.5));
}
