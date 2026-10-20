import { describe, expect, it } from 'vitest';
import type { IdleProducer, IdleView } from '../../api/types';
import { celebrations, nextGoals } from './goals';

function producer(index: number, level: number, extra: Partial<IdleProducer> = {}): IdleProducer {
  const names = ['아기 도로롱', '치킨 도로롱', '토끼 도로롱'];
  return { index, name: names[index] ?? `도로롱${index}`, level, nextCost: 10, baseRate: 1, ratePerSecond: 0, revealed: true, milestones: 0, outputMultiplier: 1, nextMilestone: 10, ...extra };
}

function view(producers: IdleProducer[], extra: Partial<IdleView> = {}): IdleView {
  return {
    oranges: 0, totalEarned: 0, ratePerSecond: 0, multiplierPercent: 100, tapLevel: 0, tapPower: 1, tapUpgradeCost: 100,
    collected: producers.filter((p) => p.level > 0).length, collectionTotal: 12, collectionBonusPercent: 100, nextCollectionTarget: 4, nextCollectionPercent: 125,
    producers, serverTimeMillis: 0, offlineSeconds: 0, offlineGained: 0, offlineCapped: false, orangeCap: 9e15, ...extra,
  };
}

describe('목표 안내', () => {
  it('마일스톤까지 레벨이 가장 적게 남은 도로롱을 알려 준다', () => {
    const goals = nextGoals(view([producer(0, 3), producer(1, 8), producer(2, 1)]));
    expect(goals[0].text).toContain('치킨 도로롱 Lv.10까지 2번');
    expect(goals[1].text).toContain('도감 4종');
  });

  it('아직 아무도 없으면 첫 도로롱을 부르라고 한다', () => {
    const goals = nextGoals(view([producer(0, 0), producer(1, 0, { revealed: false })]));
    expect(goals[0].text).toContain('아기 도로롱');
  });

  it('모든 목표를 달성하면 안내가 없다', () => {
    const goals = nextGoals(view([producer(0, 500, { nextMilestone: 0 })], { nextCollectionTarget: 0 }));
    expect(goals).toEqual([]);
  });
});

describe('축하 문구', () => {
  it('새로 닿은 마일스톤과 도감 변화만 알린다', () => {
    const before = view([producer(0, 9), producer(1, 0)]);
    const after = view([producer(0, 10, { milestones: 1, outputMultiplier: 2, nextMilestone: 25 }), producer(1, 1)]);
    const lines = celebrations(before, after);
    expect(lines.some((l) => l.includes('아기 도로롱 Lv.10') && l.includes('×2'))).toBe(true);
    expect(lines.some((l) => l.includes('도감에 올랐어요'))).toBe(true);
    expect(celebrations(after, after)).toEqual([]);
    expect(celebrations(null, after)).toEqual([]);
  });

  it('도감 완성도 보너스를 달성하면 따로 알린다', () => {
    const before = view([producer(0, 1), producer(1, 1), producer(2, 1)], { collectionBonusPercent: 100 });
    const after = view([producer(0, 1), producer(1, 1), producer(2, 1), producer(3, 1)], { collectionBonusPercent: 125, collected: 4 });
    expect(celebrations(before, after).join(' ')).toContain('도감 4종 달성');
  });
});
