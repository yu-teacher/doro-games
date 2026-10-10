import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORLD } from './engine';
import RunnerGame from './RunnerGame';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** jsdom 에는 Canvas 가 없어서, 그리기 호출을 기록하는 가짜 컨텍스트를 쓴다. */
class FakeContext {
  font = '10px sans-serif';
  fillStyle = '';
  textAlign = 'left';
  textBaseline = 'alphabetic';
  texts: Array<{ text: string; font: string }> = [];
  fontsAtDraw: string[] = [];
  scale = vi.fn();
  fillRect = vi.fn();
  beginPath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  closePath = vi.fn();
  fill = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  translate = vi.fn();
  rotate = vi.fn();
  drawImage = vi.fn();
  measureText = (text: string) => ({ width: text.length * this.fontSize() * 0.6 });
  fillText = (text: string) => { this.texts.push({ text, font: this.font }); };
  fontSize() {
    const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
    return match ? Number(match[1]) : 10;
  }
}

let root: Root | undefined;
let host: HTMLElement | undefined;
let ctx: FakeContext;
const definedOnWindow: string[] = [];

/** jsdom 에 없는 브라우저 기능(matchMedia, requestAnimationFrame)을 이 테스트 동안만 window 에 둔다 */
function defineOnWindow(name: string, value: unknown) {
  Object.defineProperty(window, name, { configurable: true, writable: true, value });
  definedOnWindow.push(name);
}

function mockEnvironment({ clientWidth, coarse }: { clientWidth: number; coarse: boolean }) {
  ctx = new FakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  // clientWidth 는 Element 에 정의돼 있어, 이 캔버스 프로토타입에만 덮어쓰고 테스트가 끝나면 지운다
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth });
  defineOnWindow('matchMedia', (query: string) => ({
    matches: coarse && query.includes('pointer: coarse'),
    media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  // 첫 프레임만 한 번 그린다(무한 루프를 돌리지 않는다)
  let frames = 0;
  defineOnWindow('requestAnimationFrame', (callback: FrameRequestCallback) => {
    if (frames++ < 1) callback(performance.now());
    return 1;
  });
  defineOnWindow('cancelAnimationFrame', () => undefined);
}

function render(props: { best?: number | null; onStart?: () => void; onGameOver?: (score: number) => void } = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const onStart = props.onStart ?? vi.fn();
  act(() => root!.render(createElement(RunnerGame, { best: props.best ?? 640, onStart, onGameOver: props.onGameOver ?? vi.fn() })));
  return { onStart };
}

const control = (label: string) => host!.querySelector(`button[aria-label^="${label}"]`) as HTMLButtonElement;
const pointer = (el: Element, type: string) => act(() => { el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })); });
const sizeOf = (font: string) => Number(/(\d+(?:\.\d+)?)px/.exec(font)![1]);
const textBy = (fragment: string) => ctx.texts.find((t) => t.text.includes(fragment));

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  // 언마운트가 cancelAnimationFrame 을 부르므로, window 에 둔 것을 지우기 전에 먼저 언마운트한다
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'clientWidth');
  definedOnWindow.splice(0).forEach((name) => Reflect.deleteProperty(window, name));
});

describe('RunnerGame 글자 크기', () => {
  it('폰처럼 캔버스가 작게 보이면 글자를 키워 그려 화면에서 읽히는 크기가 된다', () => {
    mockEnvironment({ clientWidth: 343, coarse: true });
    render();

    const score = textBy('00000')!;
    const scale = WORLD.width / 343;
    expect(sizeOf(score.font)).toBeCloseTo(16 * scale, 0);
    // 화면에서의 크기 = 월드 글자 크기 x 캔버스 축소 비율 → 원래 16px 에 가깝다 (키우지 않으면 8.6px)
    expect(sizeOf(score.font) * (343 / WORLD.width)).toBeGreaterThan(14);
  });

  it('데스크톱처럼 캔버스가 충분히 크면 글자를 키우지 않는다', () => {
    mockEnvironment({ clientWidth: WORLD.width, coarse: false });
    render();

    expect(sizeOf(textBy('00000')!.font)).toBe(16);
  });

  it('키운 안내 글자가 캔버스 폭을 넘지 않는다', () => {
    mockEnvironment({ clientWidth: 300, coarse: true });
    render();

    for (const { text, font } of ctx.texts) {
      const width = text.length * sizeOf(font) * 0.6;
      expect(width, `"${text}"`).toBeLessThanOrEqual(WORLD.width);
    }
  });

  it('점수와 BEST 가 같은 줄에서 겹치지 않는다(BEST 는 점수 왼쪽)', () => {
    mockEnvironment({ clientWidth: 343, coarse: true });
    render({ best: 1234 });

    expect(textBy('BEST 01234')).toBeDefined();
    expect(textBy('00000')).toBeDefined();
  });
});

describe('RunnerGame 안내 문구', () => {
  it('터치 화면에서는 키보드 안내(스페이스·↑) 대신 터치 안내를 보여 준다', () => {
    mockEnvironment({ clientWidth: 343, coarse: true });
    render();

    expect(textBy('화면을 터치해서 시작')).toBeDefined();
    expect(texts()).not.toContain('스페이스');
  });

  it('키보드 화면에서는 기존 안내 그대로다', () => {
    mockEnvironment({ clientWidth: WORLD.width, coarse: false });
    render();

    expect(textBy('스페이스 · ↑ · 화면 터치로 시작')).toBeDefined();
  });

  function texts() {
    return ctx.texts.map((t) => t.text).join('|');
  }
});

describe('RunnerGame 화면 조작 버튼', () => {
  it('숙이기와 점프 버튼이 있고, 터치 화면에서만 보이도록 표시돼 있다', () => {
    mockEnvironment({ clientWidth: 343, coarse: true });
    render();

    expect(control('점프')).not.toBeNull();
    expect(control('숙이기')).not.toBeNull();
    const group = control('점프').parentElement!;
    expect(group.className).toContain('hidden');
    expect(group.className).toContain('pointer-coarse:grid');
  });

  it('멈춰 있을 때 점프 버튼을 누르면 판이 시작된다', () => {
    mockEnvironment({ clientWidth: 343, coarse: true });
    const { onStart } = render();

    pointer(control('점프'), 'pointerdown');
    pointer(control('점프'), 'pointerup');

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('멈춰 있을 때 숙이기 버튼을 눌러도 판이 시작된다(캔버스 아래쪽을 누르는 것과 같다)', () => {
    mockEnvironment({ clientWidth: 343, coarse: true });
    const { onStart } = render();

    pointer(control('숙이기'), 'pointerdown');
    pointer(control('숙이기'), 'pointerup');

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('버튼에서 손가락이 벗어나거나 터치가 취소돼도 오류 없이 입력이 풀린다', () => {
    mockEnvironment({ clientWidth: 343, coarse: true });
    render();

    expect(() => {
      pointer(control('숙이기'), 'pointerdown');
      pointer(control('숙이기'), 'pointerleave');
      pointer(control('점프'), 'pointerdown');
      pointer(control('점프'), 'pointercancel');
    }).not.toThrow();
  });

  it('길게 눌러도 컨텍스트 메뉴(복사·공유)가 뜨지 않는다', () => {
    mockEnvironment({ clientWidth: 343, coarse: true });
    render();

    const event = new Event('contextmenu', { bubbles: true, cancelable: true });
    act(() => { control('점프').dispatchEvent(event); });

    expect(event.defaultPrevented).toBe(true);
  });

  it('화면 높이가 낮은 가로 모드에서는 버튼을 낮춰 한 화면에 들어오게 한다', () => {
    mockEnvironment({ clientWidth: 600, coarse: true });
    render();

    expect(control('점프').className).toContain('[@media(max-height:500px)]:h-14');
    expect(control('숙이기').className).toContain('[@media(max-height:500px)]:h-14');
  });
});
