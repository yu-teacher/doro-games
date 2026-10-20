/**
 * 화면에 보이는 귤 수. 서버가 알려 준 값(oranges)에 그 뒤로 흐른 시간만큼의 생산과 아직 서버에 보내지 않은 탭을 더해
 * 부드럽게 올라가게 보여 주되, 서버 응답이 오면 언제나 서버 값으로 다시 맞춘다(진짜 값은 서버만 안다).
 */
export interface LiveBase {
  oranges: number;
  ratePerSecond: number;
  tapPower: number;
  orangeCap: number;
}

/** 서버 값 기준 시각(receivedAtMs)에서 nowMs 까지의 화면용 귤 수(정수). 서버 한도(orangeCap)를 넘지 않는다. */
export function projectOranges(base: LiveBase, receivedAtMs: number, nowMs: number, pendingTaps: number): number {
  const seconds = Math.max(0, nowMs - receivedAtMs) / 1000;
  const flowed = Math.floor(base.ratePerSecond * seconds);
  const tapped = Math.max(0, pendingTaps) * base.tapPower;
  return Math.min(base.orangeCap, Math.floor(base.oranges + flowed + tapped));
}

/** 이 비용을 지금 화면의 귤로 낼 수 있는가(서버가 최종 판단한다. 이건 버튼을 켜고 끄는 용도) */
export function canAfford(cost: number, shown: number): boolean {
  return Number.isFinite(cost) && cost <= shown;
}

/** amount 번 사려 할 때 화면 기준으로 몇 번까지 살 수 있는지(대략: 서버는 정확히 계산한다). 비용은 한 번 값의 레벨별 합이라 여기서는 첫 비용만 본다. */
export function maxBuyHint(nextCost: number, shown: number, amount: number): number {
  if (nextCost <= 0) {
    return 0;
  }
  return Math.min(amount, Math.floor(shown / nextCost));
}
