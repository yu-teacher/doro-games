import { describe, expect, it } from 'vitest';
import { canMove, createState, fromGrid, maxTile, move, toGrid, type Direction } from './engine';

/** 새 타일이 놓이기 전의 결과를 보려고, 합쳐진 자리만 비교하는 도우미: 새로 생긴 타일(isNew)을 뺀 보드 */
function withoutSpawn(state: ReturnType<typeof createState>): number[][] {
  const clone = { ...state, tiles: state.tiles.filter((t) => !t.isNew) };
  return toGrid(clone);
}

describe('시작', () => {
  it('타일 2개로 시작하고 값은 2 또는 4 이다', () => {
    const state = createState(1);
    expect(state.tiles).toHaveLength(2);
    state.tiles.forEach((t) => expect([2, 4]).toContain(t.value));
    expect(state.score).toBe(0);
    expect(state.over).toBe(false);
  });
});

describe('밀기와 합치기', () => {
  it('왼쪽으로 밀면 빈칸을 메우고 같은 숫자는 합쳐진다', () => {
    const state = fromGrid([
      [2, 0, 2, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(move(state, 'left')).toBe(true);
    expect(withoutSpawn(state)[0]).toEqual([4, 4, 0, 0]);
    expect(state.score).toBe(4);
  });

  it('한 번의 수에서 한 타일은 한 번만 합쳐진다(2,2,2,2 → 4,4)', () => {
    const state = fromGrid([
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    move(state, 'left');
    expect(withoutSpawn(state)[0]).toEqual([4, 4, 0, 0]);
    expect(state.score).toBe(8);
  });

  it('(4,2,2) 를 합치면 앞쪽 4 가 아니라 뒤의 2,2 가 합쳐진다', () => {
    const state = fromGrid([
      [4, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    move(state, 'left');
    expect(withoutSpawn(state)[0]).toEqual([4, 4, 0, 0]);
  });

  it('네 방향 모두 같은 규칙으로 움직인다', () => {
    const base = [
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 2],
    ];
    const expected: Record<Direction, (grid: number[][]) => boolean> = {
      left: (g) => g[0][0] === 4 && g[3][0] === 4,
      right: (g) => g[0][3] === 4 && g[3][3] === 4,
      up: (g) => g[0][0] === 4 && g[0][3] === 4,
      down: (g) => g[3][0] === 4 && g[3][3] === 4,
    };
    (Object.keys(expected) as Direction[]).forEach((direction) => {
      const state = fromGrid(base);
      expect(move(state, direction)).toBe(true);
      expect(expected[direction](withoutSpawn(state))).toBe(true);
    });
  });

  it('합쳐진 타일에는 merged 표시와 사라진 타일(ghost)이 남는다', () => {
    const state = fromGrid([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    move(state, 'left');
    expect(state.tiles.filter((t) => t.merged)).toHaveLength(1);
    expect(state.ghosts).toHaveLength(1);
    expect(state.ghosts[0]).toMatchObject({ value: 2, row: 0, col: 0 });
  });
});

describe('움직이지 않는 수', () => {
  it('아무것도 움직이지 않으면 false 이고 상태와 난수가 그대로다', () => {
    const state = fromGrid([
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const before = JSON.stringify(state);
    expect(move(state, 'left')).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('움직인 수에서만 새 타일이 하나 생기고 수 횟수가 늘어난다', () => {
    const state = fromGrid([
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(move(state, 'left')).toBe(true);
    expect(state.tiles).toHaveLength(2);
    expect(state.tiles.filter((t) => t.isNew)).toHaveLength(1);
    expect(state.moves).toBe(1);
  });
});

describe('게임 오버', () => {
  it('보드가 가득 차고 합칠 수 있는 이웃이 없으면 끝난 판이다', () => {
    const state = fromGrid([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(canMove(state)).toBe(false);
    expect(state.over).toBe(true);
    expect(move(state, 'left')).toBe(false);
  });

  it('가득 차 있어도 이웃한 같은 숫자가 있으면 계속할 수 있다', () => {
    const state = fromGrid([
      [2, 2, 2, 4],
      [4, 8, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(canMove(state)).toBe(true);
    expect(state.over).toBe(false);
  });

  it('빈칸이 남아 있으면 마지막 수 뒤에도 끝나지 않는다', () => {
    const state = fromGrid([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 0, 0],
    ]);
    expect(move(state, 'right')).toBe(true);
    expect(state.over).toBe(false);
  });
});

describe('결정성과 점수', () => {
  const sequence: Direction[] = ['left', 'up', 'right', 'down', 'left', 'left', 'up', 'down', 'right', 'up'];

  function play(seed: number) {
    const state = createState(seed);
    sequence.forEach((d) => move(state, d));
    return state;
  }

  it('같은 시드와 같은 입력이면 결과가 같다', () => {
    expect(play(42)).toEqual(play(42));
  });

  it('시드가 다르면 보드가 달라진다', () => {
    expect(toGrid(play(1))).not.toEqual(toGrid(play(2)));
  });

  it('점수는 합쳐서 만든 타일 값의 합이다', () => {
    const state = fromGrid([
      [2, 2, 4, 4],
      [8, 8, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    move(state, 'left');
    expect(state.score).toBe(4 + 8 + 16);
    expect(maxTile(state)).toBe(16);
  });

  it('무작위로 오래 두어도 타일 수가 16 을 넘지 않고 합이 줄지 않는다', () => {
    const state = createState(7);
    const directions: Direction[] = ['left', 'up', 'right', 'down'];
    let sumBefore = state.tiles.reduce((s, t) => s + t.value, 0);
    for (let i = 0; i < 2000 && !state.over; i += 1) {
      if (move(state, directions[i % 4])) {
        const sum = state.tiles.reduce((s, t) => s + t.value, 0);
        // 합치기는 합을 바꾸지 않고, 새 타일(2 또는 4)만큼 늘어난다
        expect(sum - sumBefore).toBeGreaterThanOrEqual(2);
        expect(sum - sumBefore).toBeLessThanOrEqual(4);
        sumBefore = sum;
        expect(state.tiles.length).toBeLessThanOrEqual(16);
      }
    }
  });
});
