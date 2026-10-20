import type { IdleView } from '../../api/types';

/** 서버 규칙(IdleRules.MILESTONE_LEVELS)과 같은 값. 진행 막대의 이전 마일스톤을 구하는 데만 쓴다. */
export const MILESTONE_LEVELS = [10, 25, 50, 100, 200, 300, 400] as const;

/** 레벨에서 다음 마일스톤까지의 진행(0~1). 모두 닿았으면 1. */
export function milestoneProgress(level: number, milestones: number, next: number): number {
  if (next <= 0) {
    return 1;
  }
  const prev = milestones > 0 ? MILESTONE_LEVELS[milestones - 1] : 0;
  return Math.max(0, Math.min(1, (level - prev) / (next - prev)));
}

export interface Goal {
  text: string;
}

/** 가장 가까운 목표 둘: 마일스톤(생산 ×2)까지 레벨이 가장 적게 남은 도로롱, 그리고 도감 완성도. 없으면 빈 배열. */
export function nextGoals(view: IdleView): Goal[] {
  const goals: Goal[] = [];
  const candidates = view.producers.filter((p) => p.level > 0 && p.nextMilestone > 0);
  if (candidates.length > 0) {
    const nearest = candidates.reduce((best, p) => (p.nextMilestone - p.level < best.nextMilestone - best.level ? p : best));
    const left = nearest.nextMilestone - nearest.level;
    goals.push({ text: `${nearest.name} Lv.${nearest.nextMilestone}까지 ${left}번 — 생산이 두 배가 돼요` });
  } else {
    const first = view.producers.find((p) => p.level === 0 && p.revealed);
    if (first) {
      goals.push({ text: `${first.name}을(를) 불러 보세요 — 도감이 채워져요` });
    }
  }
  if (view.nextCollectionTarget > 0) {
    goals.push({
      text: `도감 ${view.nextCollectionTarget}종 모으기(${view.collected}/${view.nextCollectionTarget}) — 전체 생산 ×${(view.nextCollectionPercent / 100).toFixed(2)}`,
    });
  }
  return goals;
}

/** 새로 닿은 마일스톤과 도감 목표를 알리는 문장들(이전 모습과 새 모습을 견준다) */
export function celebrations(prev: IdleView | null, next: IdleView): string[] {
  if (!prev) {
    return [];
  }
  const out: string[] = [];
  for (const p of next.producers) {
    const before = prev.producers[p.index];
    if (before && p.milestones > before.milestones) {
      out.push(`🎉 ${p.name} Lv.${p.level}! 생산이 ×${p.outputMultiplier}가 됐어요`);
    }
  }
  if (next.collectionBonusPercent > prev.collectionBonusPercent) {
    out.push(`📖 도감 ${next.collected}종 달성! 전체 생산 ×${(next.collectionBonusPercent / 100).toFixed(2)}`);
  } else if (next.collected > prev.collected) {
    out.push(`✨ 새 도로롱이 도감에 올랐어요 (${next.collected}/${next.collectionTotal})`);
  }
  return out;
}
