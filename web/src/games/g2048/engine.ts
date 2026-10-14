/**
 * 2048 의 게임 규칙. 화면과 분리된 순수 로직이라 같은 시드와 같은 입력이면 항상 같은 결과가 나온다.
 * 타일은 id 를 가지고 있어서 화면이 "어디서 어디로 움직였는지" 를 그릴 수 있다(애니메이션용 정보: from*, isNew, merged, ghosts).
 */
import { nextRandom } from '../runner/engine';

export const SIZE = 4;
/** 새 타일이 4 일 확률(나머지는 2) */
const FOUR_CHANCE = 0.1;
const START_TILES = 2;

export type Direction = 'left' | 'right' | 'up' | 'down';

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  /** 이번 수가 시작될 때의 자리(움직이지 않았으면 현재 자리와 같다) */
  fromRow: number;
  fromCol: number;
  /** 이번 수에서 새로 나타났다 */
  isNew: boolean;
  /** 이번 수에서 두 타일이 합쳐져 만들어졌다 */
  merged: boolean;
}

/** 합쳐지면서 사라지는 타일. 합쳐진 자리로 미끄러져 들어가는 모습을 그리는 데만 쓴다. */
export interface Ghost {
  value: number;
  fromRow: number;
  fromCol: number;
  row: number;
  col: number;
}

export interface Game2048State {
  tiles: Tile[];
  ghosts: Ghost[];
  score: number;
  /** 성공적으로 둔 수의 횟수 */
  moves: number;
  rng: number;
  nextId: number;
  over: boolean;
}

interface Cell {
  row: number;
  col: number;
}

function randomOf(state: Game2048State): number {
  const { value, next } = nextRandom(state.rng);
  state.rng = next;
  return value;
}

function emptyCells(tiles: Tile[]): Cell[] {
  const taken = new Set(tiles.map((t) => t.row * SIZE + t.col));
  const cells: Cell[] = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!taken.has(row * SIZE + col)) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

function spawn(state: Game2048State): void {
  const cells = emptyCells(state.tiles);
  if (cells.length === 0) {
    return;
  }
  const cell = cells[Math.floor(randomOf(state) * cells.length)];
  const value = randomOf(state) < FOUR_CHANCE ? 4 : 2;
  state.tiles.push({ id: state.nextId, value, row: cell.row, col: cell.col, fromRow: cell.row, fromCol: cell.col, isNew: true, merged: false });
  state.nextId += 1;
}

export function createState(seed: number): Game2048State {
  const state: Game2048State = { tiles: [], ghosts: [], score: 0, moves: 0, rng: seed >>> 0, nextId: 1, over: false };
  for (let i = 0; i < START_TILES; i += 1) {
    spawn(state);
  }
  return state;
}

/** 줄(line) 번호와 그 줄 안의 순서(k, 0 이 진행 방향의 끝)를 보드 좌표로 바꾼다. */
function cellAt(direction: Direction, line: number, k: number): Cell {
  switch (direction) {
    case 'left':
      return { row: line, col: k };
    case 'right':
      return { row: line, col: SIZE - 1 - k };
    case 'up':
      return { row: k, col: line };
    case 'down':
      return { row: SIZE - 1 - k, col: line };
  }
}

/** 진행 방향의 끝에 가까운 타일부터 놓은 줄 번호별 타일 목록 */
function linesOf(tiles: Tile[], direction: Direction): Tile[][] {
  const lines: Tile[][] = Array.from({ length: SIZE }, () => []);
  for (const tile of tiles) {
    const horizontal = direction === 'left' || direction === 'right';
    lines[horizontal ? tile.row : tile.col].push(tile);
  }
  const order = (tile: Tile): number => {
    switch (direction) {
      case 'left':
        return tile.col;
      case 'right':
        return -tile.col;
      case 'up':
        return tile.row;
      case 'down':
        return -tile.row;
    }
  };
  lines.forEach((line) => line.sort((a, b) => order(a) - order(b)));
  return lines;
}

/**
 * 한 수를 둔다. 아무것도 움직이지 않으면 false 를 돌려주고 상태(난수 포함)를 바꾸지 않는다.
 * 움직였으면 점수를 더하고 새 타일 한 개를 놓은 뒤, 더 둘 수가 없으면 판을 끝낸다.
 */
export function move(state: Game2048State, direction: Direction): boolean {
  if (state.over) {
    return false;
  }
  const next: Tile[] = [];
  const ghosts: Ghost[] = [];
  let gained = 0;
  let changed = false;

  for (const [line, tiles] of linesOf(state.tiles, direction).entries()) {
    let k = 0;
    let last: Tile | null = null;
    for (const tile of tiles) {
      if (last !== null && !last.merged && last.value === tile.value) {
        // 바로 앞 타일과 합친다: 앞 타일이 두 배가 되고, 이 타일은 그 자리로 미끄러져 들어가며 사라진다
        const target = cellAt(direction, line, k - 1);
        ghosts.push({ value: tile.value, fromRow: tile.row, fromCol: tile.col, row: target.row, col: target.col });
        last.value *= 2;
        last.merged = true;
        gained += last.value;
        changed = true;
        continue;
      }
      const target = cellAt(direction, line, k);
      const moved: Tile = { ...tile, fromRow: tile.row, fromCol: tile.col, row: target.row, col: target.col, isNew: false, merged: false };
      if (moved.row !== tile.row || moved.col !== tile.col) {
        changed = true;
      }
      next.push(moved);
      last = moved;
      k += 1;
    }
  }

  if (!changed) {
    return false;
  }
  state.tiles = next;
  state.ghosts = ghosts;
  state.score += gained;
  state.moves += 1;
  spawn(state);
  state.over = !canMove(state);
  return true;
}

/** 어느 방향으로든 한 수를 더 둘 수 있는지(빈칸이 있거나 이웃한 같은 숫자가 있는지) */
export function canMove(state: Game2048State): boolean {
  if (state.tiles.length < SIZE * SIZE) {
    return true;
  }
  const grid = new Map(state.tiles.map((t) => [t.row * SIZE + t.col, t.value]));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = grid.get(row * SIZE + col);
      if (value === grid.get(row * SIZE + col + 1) && col + 1 < SIZE) {
        return true;
      }
      if (value === grid.get((row + 1) * SIZE + col) && row + 1 < SIZE) {
        return true;
      }
    }
  }
  return false;
}

export function maxTile(state: Game2048State): number {
  return state.tiles.reduce((best, t) => Math.max(best, t.value), 0);
}

/** 테스트와 화면 확인용: 4x4 숫자 배열(0 = 빈칸)로 상태를 만든다. */
export function fromGrid(grid: number[][], seed = 1): Game2048State {
  const state: Game2048State = { tiles: [], ghosts: [], score: 0, moves: 0, rng: seed >>> 0, nextId: 1, over: false };
  grid.forEach((cells, row) =>
    cells.forEach((value, col) => {
      if (value > 0) {
        state.tiles.push({ id: state.nextId, value, row, col, fromRow: row, fromCol: col, isNew: false, merged: false });
        state.nextId += 1;
      }
    }),
  );
  state.over = !canMove(state);
  return state;
}

export function toGrid(state: Game2048State): number[][] {
  const grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
  state.tiles.forEach((t) => {
    grid[t.row][t.col] = t.value;
  });
  return grid;
}
