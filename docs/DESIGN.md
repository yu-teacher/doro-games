# 설계 메모

## 구조
- `src/` Spring Boot 백엔드: Doro IAM(OAuth, BFF 세션 쿠키) + Doro Guard(ReBAC) 연동. 독립 DB `service_games`.
- `web/` React + Vite PWA. 게임은 Canvas 로 그리고, 규칙은 화면과 분리된 순수 함수(`engine.ts`)로 둔다.

## 게임 한 개를 추가하는 방법
1. `web/src/games/<slug>/` 에 규칙(`engine.ts`, 테스트 포함)과 Canvas 컴포넌트를 만든다. 컴포넌트는 `GameComponentProps` 규약을 따른다.
2. `web/src/games/registry.ts` 에 slug 로 등록한다.
3. Flyway 마이그레이션(`V{N}__*.sql`)으로 `games` 에 행을 추가한다. 손으로 INSERT 하지 않는다.
4. `application.yaml` 의 `games.scoring.rules.<slug>.max-points-per-second` 를 정한다. 규칙이 없는 게임은 기록을 받지 않는다.

## 점수 신뢰
- 클라이언트가 보낸 점수를 그대로 믿지 않는다. 판은 서버가 발급(`POST /games/{slug}/runs`)하고 시작 시각을 서버가 기록한다.
- 제출 시 `점수 <= 초당 최대 점수 × (서버가 잰 경과 시간 + 네트워크 여유)` 가 아니면 거절한다. 한 판은 한 번만 제출할 수 있고, 거절된 판도 닫힌다.
- 다음 단계: 서버가 시드를 발급하고 입력 로그를 제출받아 같은 규칙으로 재생(replay)해 점수를 재현한다. 엔진이 결정적이라 가능하다.

## 권한
- 목록·랭킹은 공개, 판 시작·점수 제출은 로그인.
- 게임 열기/닫기는 Guard `games_game#manager` 만 할 수 있다(`@DoroGuard`). 코드에 역할 분기를 두지 않는다.
