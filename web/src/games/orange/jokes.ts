import { isTrapKind, type GameEvent, type GateKind } from './engine';

/**
 * 개그 대사 모음. 대사를 코드에 흩뿌리지 않고 여기 한 곳에 모아서, 추가하기 쉽게 한다.
 * 어떤 대사를 고를지는 연출(화면)의 몫이라 엔진의 난수와 섞이지 않는다. {@link pick} 은 번호로 고르므로 테스트도 결정적이다.
 */

export function pick<T>(list: readonly T[], n: number): T {
  return list[((n % list.length) + list.length) % list.length];
}

/** 게이트 위에 쓰는 우스꽝스러운 이름(이로운 것과 함정 모두) */
export const GATE_TITLES: Record<GateKind, readonly string[]> = {
  shotsUp: ['귤 한 박스', '비타민C 충전', '귤 까먹기', '한 입 더', '귤 택배 도착'],
  shotsMul: ['귤 대량 입고', '귤이 귤을 낳는다', '귤 복사 버그', '귤 폭발'],
  rateUp: ['당 충전', '손이 빨라짐', '귤 까는 속도', '카페인 말고 귤'],
  dmgUp: ['과즙 팡팡', '신맛 강화', '껍질 단단히', '새콤 강타'],
  shotsDown: ['야근', '월요일', '귤이 썩었다', '손이 시림', '회식'],
  shotsHalf: ['월급 나누기', '귤 반쪽', '도둑 습격', '나눠 먹기'],
  dmgDown: ['과즙 빠짐', '귤이 시들었다', '신맛 사라짐', '힘이 쭉'],
  rateDown: ['손이 느려짐', '귤 까기 귀찮음', '월요병', '졸음 운전'],
};

/** 들어가기 전에는 효과를 알 수 없는 칸 */
export const HIDDEN_TITLE = '미스터리';
export const HIDDEN_TEXT = '???';

/** 게이트 가운데에 크게 쓰는 값 표기 */
export function gateValueText(kind: GateKind, value: number): string {
  switch (kind) {
    case 'shotsUp':
      return `+${value}`;
    case 'shotsMul':
      return `×${value}`;
    case 'rateUp':
      return `연사 +${value}`;
    case 'dmgUp':
      return `공격 +${value}`;
    case 'shotsDown':
      return `−${value}`;
    case 'shotsHalf':
      return `÷${value}`;
    case 'dmgDown':
      return `공격 −${value}%`;
    case 'rateDown':
      return `연사 −${value}`;
  }
}

export function isTrap(kind: GateKind): boolean {
  return isTrapKind(kind);
}

/** 적을 쓰러뜨릴 때 떠오르는 짧은 말 */
export const KILL_QUIPS: readonly string[] = ['도로롱~', 'Doro!', '귤 내놔', '퍽!', '으악', '굿', 'Nice귤', '헛!', '꾹', '귤벌', '쾅', '아야'];
export const BRUTE_QUIPS: readonly string[] = ['덩치 컷!', '비싼 놈이었다', '이게 귤 맛이다'];
export const BOULDER_QUIPS: readonly string[] = ['귤즙 팡!', '큰 귤이 터졌다', '귤 폭발!', '새콤하다'];

export const ITEM_QUIPS: Record<'orange' | 'chicken' | 'cash' | 'star' | 'pierce' | 'bomb', readonly string[]> = {
  orange: ['귤 보호막!', '귤 한 개 장전', '든든하다'],
  chicken: ['치킨 버프!', '닭다리 파워', '손이 안 보인다'],
  cash: ['월급 두 배!', '통장이 웃는다', '돈다발 획득'],
  star: ['무적 도로롱!', '별을 먹었다', '지금은 못 건드려'],
  pierce: ['관통 귤!', '다 뚫어 버려', '귤이 안 멈춘다'],
  bomb: ['폭탄 장전!', '쾅 할 시간', '귤 폭탄 획득'],
};

export const BOMB_QUIPS: readonly string[] = ['귤 폭탄 투하!', '펑! 귤즙', '과즙 폭발', '새콤달콤 폭격'];

export const SNIPER_QUIPS: readonly string[] = ['저격수 컷!', '귤 씨는 이제 그만', '조준이 빗나갔다', '명사수도 귤 앞에선'];
export const RUNNER_QUIPS: readonly string[] = ['쌩쌩 컷!', '너무 빨랐나', '줄줄이 쓰러진다'];

/** 경고 문구: 곧 오는 위협을 미리 알려 준다(보스는 별도) */
export const WARN_TEXT = { runner: '⚠ 돌진 도로롱!', rush: '⚠ 도로롱 러시!', sniper: '⚠ 저격 도로롱!' } as const;
export const WARN_SUB: Record<'runner' | 'rush' | 'sniper', readonly string[]> = {
  runner: ['한 줄로 달려와요', '줄을 바꿔요!', '빠르다 빨라'],
  rush: ['엄청 많이 와요', '귤 도둑 대이동', '이건 좀 많은데'],
  sniper: ['멀리서 쏴요', '귤 씨를 조심해요', '나를 노리고 있어요'],
};
export const WARN_BOSS = '⚠ WARNING';

export const SHIELD_BREAK_QUIPS: readonly string[] = ['귤이 대신 맞았다!', '귤 터짐!', '한 번은 봐줄게'];

export const INFINITE_TITLE = '∞ 무한 모드 돌입!';
export const INFINITE_LINES: readonly string[] = ['여기서부터는 끝이 없어요', '이제부터 도로롱도 모른다', '귤의 끝은 없다', '살아남는 자가 귤을 먹는다'];

/** 보스 한 명의 이름과 대사. 모습(스프라이트 변형 boss[0..])의 순서와 같아야 한다. */
export interface BossProfile {
  name: string;
  intro: readonly string[];
  shield: readonly string[];
  down: readonly string[];
}

export const BOSSES: readonly BossProfile[] = [
  {
    name: '근육 도로롱',
    intro: ['귤은 내 거다', '오늘 하체 하는 날이다', '단백질 없이 귤은 못 먹지', '헬스장 관장 등판', '중량 올린다'],
    shield: ['근육 방어!', '지금은 못 때려', '대흉근 막기'],
    down: ['단백질이… 부족했나…', '다음엔 닭가슴살 먹고 온다', '근손실이…', '귤은… 너 가져라…'],
  },
  {
    name: '폐하 도로롱',
    intro: ['짐이 귤을 원하노라', '무엄하다!', '수라상에 귤이 빠졌구나', '어좌를 넘보느냐'],
    shield: ['어명이다!', '곤룡포 방어!', '근접 불가'],
    down: ['짐의 귤이…', '이 반란을 기억하겠다…', '폐하가… 쓰러졌다…', '귤은… 백성에게…'],
  },
  {
    name: '탐정 도로롱',
    intro: ['범인은 이 안에 있어', '귤을 훔친 건 너로군', '추리가 끝났다', '수사 개시'],
    shield: ['증거 인멸!', '트렌치코트 방어', '알리바이 완벽'],
    down: ['내 추리가… 틀렸다니…', '범인은… 귤이었다…', '사건은 미궁 속으로…', '다음 사건에서 보자…'],
  },
  {
    name: '펭귄 도로롱',
    intro: ['귤은 남극에도 없다', '뒤뚱뒤뚱 등판', '여기가 내 얼음판이다', '꽥! 아니 펭!'],
    shield: ['얼음 방벽!', '털이 두껍다', '미끄러워서 안 맞아'],
    down: ['녹아내린다…', '남극으로 돌아간다…', '생선이 먹고 싶다…', '귤은 시원했다…'],
  },
];

/** index 번째 보스(1부터). 모습이 돌아가며 나오는 것과 같은 규칙으로 고른다. */
export function bossProfile(index: number): BossProfile {
  return BOSSES[(((index - 1) % BOSSES.length) + BOSSES.length) % BOSSES.length];
}

export const GAME_OVER_LINES: Record<'touch' | 'shot', readonly string[]> = {
  touch: ['부딪혔다!', '도로롱은 눈물을 닦았다', '한 방이면 끝나는 게 인생', '다음엔 보호막부터 챙기자', '귤 도둑에게 밟혔다', '큰 귤은 피하는 게 상책'],
  shot: ['덤벨에 맞았다', '3대 500 덤벨이었다', '도로롱이 이불 속으로 들어갔다', '근육의 힘은 위대했다'],
};

/** 점수로 정해지는 칭호. 기준 점수는 오름차순이다. */
export const RANKS: readonly { from: number; title: string }[] = [
  { from: 0, title: '귤 입문자' },
  { from: 1000, title: '귤 까는 사람' },
  { from: 5000, title: '귤 수집가' },
  { from: 15000, title: '귤 장인' },
  { from: 40000, title: '귤 대통령' },
  { from: 100000, title: '전설의 도로롱' },
];

export function rankTitle(score: number): string {
  let title = RANKS[0].title;
  for (const rank of RANKS) {
    if (score >= rank.from) {
      title = rank.title;
    }
  }
  return title;
}

export const TIPS: readonly string[] = [
  '게이트를 겨눠서 쏘면 숫자가 조금 올라가요',
  '귤을 먹으면 한 번은 막아 줘요',
  '함정 게이트는 피하는 게 상책',
  '연속으로 잡으면 점수 배율이 올라요',
  '큰 숫자는 피하고, 작은 숫자는 쏴서 부숴요',
  '10스테이지마다 근육 도로롱이 와요',
  '내 화력보다 큰 숫자는 비켜 가요',
  '좋은 칸은 좁고 나쁜 칸은 넓어요',
  '미스터리 칸은 들어가 봐야 알아요',
  '100스테이지부터는 무한 모드예요',
  '치킨을 먹으면 손이 안 보여요',
];

/** 엔진 이벤트에 맞는 떠오르는 말(없으면 null). pickIndex 는 연출용 난수. */
export function quipFor(event: GameEvent, pickIndex: number): string | null {
  switch (event.t) {
    case 'kill':
      if (event.kind === 'boss') {
        return null;
      }
      if (event.kind === 'brute') {
        return pick(BRUTE_QUIPS, pickIndex);
      }
      if (event.kind === 'sniper') {
        return pick(SNIPER_QUIPS, pickIndex);
      }
      if (event.kind === 'runner') {
        return pickIndex % 4 === 0 ? pick(RUNNER_QUIPS, pickIndex) : null;
      }
      if (event.kind === 'boulder') {
        return pick(BOULDER_QUIPS, pickIndex);
      }
      return pickIndex % 3 === 0 ? pick(KILL_QUIPS, pickIndex) : null;
    case 'item':
      return pick(ITEM_QUIPS[event.kind], pickIndex);
    case 'shieldBreak':
      return pick(SHIELD_BREAK_QUIPS, pickIndex);
    default:
      return null;
  }
}
