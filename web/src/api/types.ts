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

export interface Game {
  slug: string;
  title: string;
  description: string;
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
  producers: IdleProducer[];
  serverTimeMillis: number;
  offlineSeconds: number;
  offlineGained: number;
  offlineCapped: boolean;
  orangeCap: number;
}
