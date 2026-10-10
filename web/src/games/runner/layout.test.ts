import { describe, expect, it } from 'vitest';
import { WORLD } from './engine';
import { MAX_UI_SCALE, fitFontSize, uiScaleFor } from './layout';

describe('uiScaleFor', () => {
  it('캔버스가 월드 폭 이상으로 보이면 키우지 않는다(데스크톱)', () => {
    expect(uiScaleFor(WORLD.width)).toBe(1);
    expect(uiScaleFor(900)).toBe(1);
  });

  it('캔버스가 작게 보일수록 글자를 크게 그려 화면에서는 원래 크기로 보이게 한다', () => {
    // 폰: 343px 폭이면 월드의 0.54배로 그려지므로 약 1.87배로 그려야 화면에서 같은 크기다
    expect(uiScaleFor(343)).toBeCloseTo(WORLD.width / 343, 5);
    expect(16 * uiScaleFor(343) * (343 / WORLD.width)).toBeCloseTo(16, 5);
  });

  it('아주 좁아도 배율에 상한이 있어 글자가 캔버스를 덮지 않는다', () => {
    expect(uiScaleFor(100)).toBe(MAX_UI_SCALE);
  });

  it('폭을 모르면(0, NaN, 음수) 1 로 둔다', () => {
    expect(uiScaleFor(0)).toBe(1);
    expect(uiScaleFor(Number.NaN)).toBe(1);
    expect(uiScaleFor(-5)).toBe(1);
  });
});

describe('fitFontSize', () => {
  const widthOf = (chars: number) => (size: number) => chars * size * 0.6;

  it('들어가면 그대로 둔다', () => {
    expect(fitFontSize(20, 600, widthOf(10))).toBe(20);
  });

  it('넘치면 폭에 딱 맞게 줄인다', () => {
    const size = fitFontSize(40, 300, widthOf(20)); // 20자 x 40 x 0.6 = 480 > 300
    expect(widthOf(20)(size)).toBeCloseTo(300, 5);
    expect(size).toBeLessThan(40);
  });

  it('폭이 0 인 빈 글자는 줄이지 않는다', () => {
    expect(fitFontSize(20, 100, () => 0)).toBe(20);
  });
});
