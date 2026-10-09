import type { ComponentType } from 'react';
import RunnerGame from './runner/RunnerGame';

/** 모든 미니게임이 따르는 공통 규약. 게임은 규칙과 그리기만 맡고, 판 시작·기록 제출은 페이지가 맡는다. */
export interface GameComponentProps {
  /** 내 최고 기록(없으면 null) */
  best: number | null;
  /** 새 판이 시작될 때 */
  onStart: () => void;
  /** 판이 끝났을 때(점수는 게임이 센 값) */
  onGameOver: (score: number) => void;
}

/** 새 미니게임은 서버의 games 목록(slug)과 같은 이름으로 여기에 등록한다. */
export const GAME_COMPONENTS: Record<string, ComponentType<GameComponentProps>> = {
  runner: RunnerGame,
};
