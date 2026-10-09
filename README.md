# 도로 게임 천국 (Doro Games)

[![CI](https://github.com/yu-teacher/doro-games/actions/workflows/ci.yml/badge.svg)](https://github.com/yu-teacher/doro-games/actions/workflows/ci.yml)

잠깐 쉬어 가는 **웹 미니게임 포털**입니다. [Doro 플랫폼](https://github.com/yu-teacher/doro)의 서브 서비스로, 로그인은 Doro OAuth, 권한은 Doro Guard(ReBAC)가 맡고, 이 서비스는 게임 카탈로그·판·기록·랭킹을 다룹니다.

## 게임
| 게임 | 설명 |
| --- | --- |
| 도로 러너 | 달리는 도로 위의 장애물(콘, 드론)을 점프와 숙이기로 피하는 러너. 오래 달릴수록 빨라집니다. |

미니게임은 계속 추가할 예정입니다(추가 방법은 [docs/DESIGN.md](docs/DESIGN.md)).

## 설계 하이라이트
- **게임 규칙은 화면과 분리된 순수 함수**입니다. 고정 시간 단계(1/60초)와 시드 난수로 같은 입력이면 같은 결과가 나오므로, 단위 테스트가 쉽고 서버 재생(replay) 검증으로 확장할 수 있습니다.
- **점수는 서버가 발급한 판에 묶입니다.** 서버가 잰 경과 시간 안에 낼 수 있는 점수만 인정하고, 한 판은 한 번만 제출할 수 있습니다.
- **권한은 Guard 가 판정합니다.** 게임 열기/닫기는 `games_game#manager` 관계로만 결정하며 코드에 역할 분기를 두지 않습니다.
- **BFF 로그인.** 브라우저는 HttpOnly 세션 쿠키만 가지고, OAuth 토큰은 서버에 암호화해 저장합니다(PKCE, CSRF 헤더).

## 구성
| 위치 | 내용 |
| --- | --- |
| `src/` | Spring Boot 4 / Java 25 백엔드, Flyway(`games_schema_history`), `ddl-auto: validate` |
| `web/` | React + Vite PWA, `/games/` 하위 경로에 마운트 |
| `scripts/` | CI 테스트(격리 스택), 서버 배포·준비 스크립트 |
| `deploy/` | 게이트웨이 설정 조각 |

## 로컬 실행
형제 디렉터리에 `../Doro` 가 있어야 합니다(SDK 를 소스로 포함 빌드).

```bash
cp .env.example .env   # 값을 채운다
./gradlew bootRun      # API :8087
cd web && npm ci && npm run dev   # 웹 :3006 → http://localhost:3006/games/
```

로그인을 쓰려면 로컬 IAM 에 OAuth 클라이언트 `doro-games`(redirect URI `http://localhost:3006/games/api/v1/bff/callback`, 자사 앱)를 등록해야 합니다.

## 테스트
```bash
scripts/ci-test.sh          # 격리된 Postgres/Redis/Guard 를 띄워 백엔드·프런트 전체
scripts/ci-test.sh web      # 프런트만
```
