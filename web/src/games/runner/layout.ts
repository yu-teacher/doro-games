import { WORLD } from './engine';

/**
 * 캔버스 글자를 키우는 최대 배율. 게임 세계는 640px 폭으로 고정돼 있어 폰에서는 0.5배 안팎으로 줄어 그려진다.
 * 그대로 그리면 점수·안내 글자가 화면에서 8~10px 가 되어 읽을 수 없다.
 */
export const MAX_UI_SCALE = 2.2;

/** 화면에서 보이는 캔버스 폭(CSS px)으로, 글자를 월드 좌표에서 얼마나 크게 그려야 화면에서 원래 크기로 보이는지(1 이상). */
export function uiScaleFor(canvasCssWidth: number): number {
  if (!Number.isFinite(canvasCssWidth) || canvasCssWidth <= 0) {
    return 1;
  }
  return Math.min(MAX_UI_SCALE, Math.max(1, WORLD.width / canvasCssWidth));
}

/**
 * 글자가 maxWidth 안에 들어오는 가장 큰 크기(최대 size). 키운 글자가 캔버스 폭을 넘어 잘리지 않게 한다.
 * @param widthAt 주어진 글자 크기로 그렸을 때의 폭을 돌려주는 함수(ctx.measureText 등)
 */
export function fitFontSize(size: number, maxWidth: number, widthAt: (fontSize: number) => number): number {
  const width = widthAt(size);
  if (width <= maxWidth || width <= 0) {
    return size;
  }
  return size * (maxWidth / width);
}
