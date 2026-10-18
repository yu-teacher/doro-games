import { describe, expect, it } from 'vitest';
import { formatCount } from './format';

describe('formatCount', () => {
  it('1만 미만은 그대로', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(7680)).toBe('7680');
    expect(formatCount(9999)).toBe('9999');
  });

  it('1만 이상은 만 단위(작을 때만 소수 한 자리, 끝의 .0 은 없앤다)', () => {
    expect(formatCount(10000)).toBe('1만');
    expect(formatCount(12345)).toBe('1.2만');
    expect(formatCount(194464)).toBe('19.4만');
    expect(formatCount(1_000_000)).toBe('100만');
    expect(formatCount(12_345_678)).toBe('1235만');
  });

  it('1억 이상은 억 단위', () => {
    expect(formatCount(100_000_000)).toBe('1억');
    expect(formatCount(250_000_000)).toBe('2.5억');
  });

  it('조·경 단위까지 읽는다(JS 정수의 안전 한계 9007조 부근까지)', () => {
    expect(formatCount(1_000_000_000_000)).toBe('1조');
    expect(formatCount(9_400_000_000_000)).toBe('9.4조');
    expect(formatCount(Number.MAX_SAFE_INTEGER)).toBe('9007조');
    expect(formatCount(20_000_000_000_000_000)).toBe('2경');
  });

  it('음수나 소수는 0 이상의 정수로 다룬다', () => {
    expect(formatCount(-5)).toBe('0');
    expect(formatCount(12.9)).toBe('12');
  });
});
