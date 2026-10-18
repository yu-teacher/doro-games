/**
 * 게임 그림 불러오기. 그림 파일은 git 에 두지 않고 객체 저장소(MinIO)에서 받는다.
 * 시작할 때 `manifest.json`(키 → 파일 이름)을 읽고 각 그림을 불러오며, 없거나 실패하면 그 그림은 도형으로 대신 그린다.
 * 그래서 그림이 없는 환경(테스트, 새로 받은 개발 환경)에서도 게임은 항상 돈다.
 */

export type SpriteKey = 'hero' | 'swarm' | 'slime' | 'wall' | 'elite' | 'boss' | 'orange' | 'chicken' | 'cash' | 'star' | 'bg';

export const SPRITE_KEYS: readonly SpriteKey[] = ['hero', 'swarm', 'slime', 'wall', 'elite', 'boss', 'orange', 'chicken', 'cash', 'star', 'bg'];

export interface Manifest {
  version: number;
  sprites: Partial<Record<SpriteKey, { file: string; w: number; h: number }>>;
}

export type Sprites = Partial<Record<SpriteKey, HTMLImageElement>>;

/** manifest 에서 알 수 없는 키·잘못된 모양은 버린다(서버의 파일을 그대로 믿지 않는다). */
export function parseManifest(raw: unknown): Manifest | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const { version, sprites } = raw as { version?: unknown; sprites?: unknown };
  if (typeof version !== 'number' || typeof sprites !== 'object' || sprites === null) {
    return null;
  }
  const clean: Manifest['sprites'] = {};
  for (const key of SPRITE_KEYS) {
    const entry = (sprites as Record<string, unknown>)[key];
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const { file, w, h } = entry as { file?: unknown; w?: unknown; h?: unknown };
    // 파일 이름은 같은 폴더의 평범한 이름만 허용한다(경로 이동·외부 주소 금지)
    if (typeof file === 'string' && /^[A-Za-z0-9._-]+$/.test(file) && typeof w === 'number' && typeof h === 'number') {
      clean[key] = { file, w, h };
    }
  }
  return { version, sprites: clean };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** 불러올 수 있는 그림만 담아 돌려준다. 하나도 못 불러와도 오류가 아니다. */
export async function loadSprites(base: string, signal?: AbortSignal): Promise<Sprites> {
  try {
    const response = await fetch(`${base}manifest.json`, { cache: 'no-cache', signal });
    if (!response.ok) {
      return {};
    }
    const manifest = parseManifest(await response.json());
    if (!manifest) {
      return {};
    }
    const entries = await Promise.all(
      (Object.keys(manifest.sprites) as SpriteKey[]).map(async (key) => {
        const meta = manifest.sprites[key];
        return [key, meta ? await loadImage(`${base}${meta.file}`) : null] as const;
      }),
    );
    const sprites: Sprites = {};
    for (const [key, image] of entries) {
      if (image) {
        sprites[key] = image;
      }
    }
    return sprites;
  } catch (error) {
    if (!signal?.aborted) {
      console.warn('Game sprites are not available; drawing placeholders instead', error);
    }
    return {};
  }
}
