# 배포

Doro 서브 서비스 표준 절차(워크스페이스 `Doro/AGENTS.md` 5장)를 따른다. 구성은 `doro-party` 와 같다.

1. **서버 준비(최초 1회)**: `scripts/setup-games-server.sh` — `service_games` DB, `~/doro-games/.env`, Guard 서비스 토큰, OAuth 클라이언트 `doro-games` 를 만든다. 먼저 `--dry-run` 으로 계획을 본다.
2. **compose 파일 복사**: `scp docker-compose.prod.yml mini:doro-games/`
3. **게이트웨이 반영**: `deploy/gateway-games.conf` 를 `scripts/apply-gateway-games.sh` 로 반영한다(CSP 는 `--report-only` 로 먼저).
4. **CI/CD**: 셀프호스티드 러너를 등록하고 저장소 변수 `CD_ENABLED=true` 로 켠다. `main` 에서 CI 가 통과한 커밋만 `scripts/deploy-on-server.sh` 가 배포한다(롤백 스냅샷, DB 백업, 헬스체크 실패 시 자동 복구).

포트: API `8087`, 웹 `3006`(둘 다 `127.0.0.1` 바인딩, 게이트웨이가 `/games/` 로 연결).
