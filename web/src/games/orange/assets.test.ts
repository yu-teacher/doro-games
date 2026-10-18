import { describe, expect, it } from 'vitest';
import { parseManifest } from './assets';

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
