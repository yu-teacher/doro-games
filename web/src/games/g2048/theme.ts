/**
 * 2048 의 도로롱 컨셉: 타일 값마다 다른 의상의 도로롱이 나온다(2 → 기본, 점점 화려하게, 2048 은 폐하).
 * 그림은 게임 그림 묶음(manifest 의 variants.tile)에 순서대로 들어 있고, 없으면 예전처럼 숫자만 보인다.
 */
export const TILE_NAMES: readonly string[] = [
  '아기 도로롱', // 2
  '치킨 도로롱', // 4
  '토끼 도로롱', // 8
  '펭귄 도로롱', // 16
  '공룡 도로롱', // 32
  '상어 도로롱', // 64
  '수박 도로롱', // 128
  '카우보이 도로롱', // 256
  '메이드 도로롱', // 512
  '근육 도로롱', // 1024
  '폐하 도로롱', // 2048
];

/** 타일 값(2, 4, 8, …)이 몇 번째 단계인지(0부터). 2048 을 넘는 값도 마지막 단계로 본다. */
export function tileLevel(value: number): number {
  if (!Number.isInteger(value) || value < 2) {
    return 0;
  }
  return Math.min(TILE_NAMES.length - 1, Math.floor(Math.log2(value)) - 1);
}

/** 단계에 해당하는 타일 값(0 → 2, 1 → 4, …). */
export function tileValue(level: number): number {
  return 2 ** (level + 1);
}
