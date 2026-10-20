export interface UserProfile {
  id: string;
  username: string;
  nickname: string;
  color: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

/** minigame: 한 판씩 점수를 겨루는 게임, longplay: 진행 상황이 이어지는 게임(방치형 등) */
export type GameCategory = 'minigame' | 'longplay';

export interface Game {
  slug: string;
  title: string;
  description: string;
  category: GameCategory;
  enabled: boolean;
}

export interface Run {
  runId: string;
  startedAt: string;
}

export interface SubmitScoreResult {
  score: number;
  best: number;
  newBest: boolean;
  rank: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  color: string;
  score: number;
  achievedAt: string;
}

export interface Leaderboard {
  slug: string;
  entries: LeaderboardEntry[];
}

export interface MyRecord {
  best: number;
  plays: number;
  rank: number;
}

/** 로비 카드 한 장. 기록이 없는 필드는 null. */
export interface GameHighlight {
  slug: string;
  title: string;
  description: string;
  category: GameCategory;
  topScore: number | null;
  topNickname: string | null;
  myBest: number | null;
  myRank: number | null;
}

export interface IdleProducer {
  index: number;
  name: string;
  level: number;
  nextCost: number;
  baseRate: number;
  ratePerSecond: number;
  revealed: boolean;
  /** 닿은 마일스톤 수, 그 도로롱의 생산 배수, 다음 마일스톤 레벨(0 이면 모두 닿음) */
  milestones: number;
  outputMultiplier: number;
  nextMilestone: number;
}

/** 도로롱 귤농장: 서버가 계산한 농장의 모습 */
export interface IdleView {
  oranges: number;
  totalEarned: number;
  ratePerSecond: number;
  multiplierPercent: number;
  tapLevel: number;
  tapPower: number;
  tapUpgradeCost: number;
  collected: number;
  collectionTotal: number;
  /** 도감 완성도 보너스(%)와 다음 목표(종류 수, 그때의 배율). 모두 달성했으면 0 */
  collectionBonusPercent: number;
  nextCollectionTarget: number;
  nextCollectionPercent: number;
  producers: IdleProducer[];
  serverTimeMillis: number;
  offlineSeconds: number;
  offlineGained: number;
  offlineCapped: boolean;
  orangeCap: number;
}
