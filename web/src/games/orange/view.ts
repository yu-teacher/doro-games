import { FIELD, PX } from './engine';

/**
 * 화면 투영(그리기 전용). 엔진은 가로 x 와 깊이 z 만 알고, 원근은 여기서 계산한다.
 * 멀수록 작아지고 지평선 쪽으로 모인다: 도로롱(z=0)은 화면 아래쪽, 아주 먼 곳은 지평선에 놓인다.
 */
export const VIEW = { width: FIELD.width / PX, height: 640 } as const;

/** 지평선의 y, 도로롱이 서 있는 y, 원근의 세기(작을수록 멀리서 급격히 작아진다) */
export const HORIZON_Y = 120;
export const PLAYER_Y = 560;
const FOCAL = 420;

export interface Projected {
  x: number;
  y: number;
  /** 1 이 도로롱 위치의 크기, 멀수록 작아진다 */
  scale: number;
}

/** 월드 좌표(x, z: PX 단위)를 화면 좌표로 바꾼다. */
export function project(x: number, z: number): Projected {
  const depth = Math.max(z / PX, -FOCAL * 0.8);
  const scale = FOCAL / (FOCAL + depth);
  return {
    x: VIEW.width / 2 + (x / PX - VIEW.width / 2) * scale,
    y: HORIZON_Y + (PLAYER_Y - HORIZON_Y) * scale,
    scale,
  };
}
