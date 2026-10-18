import { describe, expect, it } from 'vitest';
import { FRAME_MS, frameAt, parseManifest, variantOf, type Sprites } from './assets';

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

describe('움직이는 그림', () => {
  it('frames 는 2~12 정수일 때만 읽는다', () => {
    const read = (frames: unknown) => parseManifest({ version: 1, sprites: { hero: { file: 'h.webp', w: 10, h: 10, frames } } })?.sprites.hero;
    expect(read(6)?.frames).toBe(6);
    expect(read(1)?.frames).toBeUndefined();
    expect(read(99)?.frames).toBeUndefined();
    expect(read(2.5)?.frames).toBeUndefined();
    expect(read('4')?.frames).toBeUndefined();
  });

  it('장면 번호는 시간에 따라 돌고 개체마다 어긋난다', () => {
    expect(frameAt(1, 12345)).toBe(0);
    expect(frameAt(4, 0)).toBe(0);
    expect(frameAt(4, FRAME_MS)).toBe(1);
    expect(frameAt(4, FRAME_MS * 4)).toBe(0);
    expect(frameAt(4, 0, 3)).toBe(3);
  });
});
