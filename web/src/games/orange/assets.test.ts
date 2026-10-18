import { describe, expect, it } from 'vitest';
import { parseManifest, variantOf, type Sprites } from './assets';

describe('parseManifest', () => {
  it('올바른 manifest 는 알려진 키만 남긴다', () => {
    const manifest = parseManifest({
      version: 1,
      sprites: { hero: { file: 'hero-ab12.webp', w: 64, h: 64 }, unknown: { file: 'x.png', w: 1, h: 1 } },
    });
    expect(manifest?.sprites.hero).toEqual({ file: 'hero-ab12.webp', w: 64, h: 64 });
    expect(Object.keys(manifest?.sprites ?? {})).toEqual(['hero']);
  });

  it('경로를 이동하거나 외부 주소를 가리키는 파일 이름은 버린다', () => {
    const manifest = parseManifest({
      version: 1,
      sprites: {
        hero: { file: '../secret.png', w: 1, h: 1 },
        boss: { file: 'https://evil.example/x.png', w: 1, h: 1 },
        orange: { file: 'a/b.png', w: 1, h: 1 },
        star: { file: 'star-1.png', w: 8, h: 8 },
      },
    });
    expect(Object.keys(manifest?.sprites ?? {})).toEqual(['star']);
  });

  it('모양이 틀리면 null', () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest('x')).toBeNull();
    expect(parseManifest({ version: 'one', sprites: {} })).toBeNull();
    expect(parseManifest({ version: 1 })).toBeNull();
  });
});

describe('변형 그림', () => {
  it('manifest 의 변형 목록에서 잘못된 항목과 모르는 키를 버린다', () => {
    const manifest = parseManifest({
      version: 1,
      sprites: {},
      variants: {
        bg: [{ file: 'bg-1.webp', w: 1, h: 1 }, { file: '../evil.png', w: 1, h: 1 }, null],
        nothing: [{ file: 'x.webp', w: 1, h: 1 }],
      },
    });
    expect(manifest?.variants.bg).toEqual([{ file: 'bg-1.webp', w: 1, h: 1 }]);
    expect(Object.keys(manifest?.variants ?? {})).toEqual(['bg']);
  });

  it('변형이 없어도 예전 manifest 는 그대로 읽힌다', () => {
    expect(parseManifest({ version: 1, sprites: {} })?.variants).toEqual({});
  });

  it('번호는 돌려 쓰고, 변형이 없으면 기본 그림으로 대신한다', () => {
    const [a, b] = [{ n: 'a' }, { n: 'b' }] as unknown as HTMLImageElement[];
    const sprites: Sprites = { variants: { grunt: [a, b] }, slime: b };
    expect(variantOf(sprites, 'grunt', 0)).toBe(a);
    expect(variantOf(sprites, 'grunt', 3)).toBe(b);
    expect(variantOf(sprites, 'grunt', -1)).toBe(b);
    expect(variantOf(sprites, 'brute', 5)).toBe(b);
    expect(variantOf({}, 'boss', 0)).toBeUndefined();
  });
});
