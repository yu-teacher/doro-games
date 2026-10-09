#!/usr/bin/env bash
# 서버(mini)에서 한 번 실행한다: 도로 게임 천국 배포 전 서버 준비. 여러 번 실행해도 결과가 같다(멱등). 비밀 값은 화면에 출력하지 않는다.
#
#   ssh mini 'bash -s -- --origin https://example.com --dry-run' < scripts/setup-games-server.sh   # 바꿀 것만 출력
#   ssh mini 'bash -s -- --origin https://example.com --apply'   < scripts/setup-games-server.sh   # 실제 반영
#
# 하는 일
#   1) Postgres 에 service_games DB 를 만든다(없을 때만).
#   2) ~/doro-games/.env 를 만든다: DB 접속 정보는 블로그 .env 에서 복사하고, 세션 암호화 키와 Guard 서비스 토큰은 새로 만든다.
#   3) ~/doro/.env 의 DORO_GUARD_SERVICE_TOKENS 에 games 토큰(schema-write)을 추가하고 Guard 를 다시 만든다(몇 초간 권한 검사 중단).
#   4) Doro IAM(doro_auth)에 OAuth 클라이언트 doro-games 를 등록한다(redirect_uri 정확히 하나).
# 하지 않는 일: 게이트웨이 nginx 설정 반영, 러너 등록, docker-compose.prod.yml 복사(안내만 한다).
set -Eeuo pipefail

GAMES_DIR="${GAMES_DIR:-$HOME/doro-games}"
DORO_DIR="${DORO_DIR:-$HOME/doro}"
BLOG_ENV="${BLOG_ENV:-$HOME/doro-blog/.env}"
CLIENT_ID="${GAMES_OAUTH_CLIENT_ID:-doro-games}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-doro-postgres}"
GUARD_SERVICE="${GUARD_SERVICE:-guard-api}"
GAMES_DB="${GAMES_DB:-service_games}"
AUTH_DB="${AUTH_DB:-doro_auth}"
ENV_FILE="$GAMES_DIR/.env"
DORO_ENV="$DORO_DIR/.env"
ORIGIN=""; APPLY=false
while [ $# -gt 0 ]; do
  case "$1" in
    --origin) ORIGIN="${2:?--origin 값이 필요하다}"; shift 2 ;;
    --apply) APPLY=true; shift ;;
    --dry-run) APPLY=false; shift ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 2 ;;
  esac
done
[ -n "$ORIGIN" ] || { echo "--origin https://<공개 도메인> 이 필요하다 (끝에 / 없이)" >&2; exit 2; }
case "$ORIGIN" in https://*) ;; *) echo "origin 은 https:// 로 시작해야 한다 (로그인 쿠키가 Secure 이다)" >&2; exit 2 ;; esac
ORIGIN="${ORIGIN%/}"
TS="$(date +%Y%m%d-%H%M%S)"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

# 키 이름만 확인하고 값은 읽어도 출력하지 않는다
env_get() { grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- || true; }
psql_in() { docker exec -i "$POSTGRES_CONTAINER" sh -c "psql -U \"\$POSTGRES_USER\" -d $1 -v ON_ERROR_STOP=1 -tA"; }

docker info >/dev/null 2>&1 || die "docker 를 사용할 수 없다"
[ -f "$BLOG_ENV" ] || die "$BLOG_ENV 가 없다 (DB 접속 정보를 여기서 복사한다)"
[ -f "$DORO_ENV" ] || die "$DORO_ENV 가 없다"
[ -n "$(env_get "$BLOG_ENV" DB_PASSWORD)" ] || die "$BLOG_ENV 에 DB_PASSWORD 가 없다"

# ---------------------------------------------------------------- 계획
need_db=false; need_env=false; need_token=false
[ "$(echo "SELECT 1 FROM pg_database WHERE datname='$GAMES_DB'" | psql_in postgres)" = 1 ] || need_db=true
[ -f "$ENV_FILE" ] || need_env=true
grep -q "[,=]games:" "$DORO_ENV" || need_token=true
client_exists="$(echo "SELECT 1 FROM oauth_clients WHERE client_id='$CLIENT_ID'" | psql_in "$AUTH_DB")"
log "계획: DB 생성=$need_db, $ENV_FILE 생성=$need_env, Guard 토큰 추가+Guard 재생성=$need_token, OAuth 클라이언트 등록/갱신=true(이미 있음: ${client_exists:-0})"
[ -f "$GAMES_DIR/docker-compose.prod.yml" ] || log "안내: $GAMES_DIR/docker-compose.prod.yml 이 없다. 로컬에서 scp 로 복사한다(아래 완료 메시지 참고)."
if [ "$APPLY" != true ]; then log "--dry-run: 여기서 종료 (--apply 로 반영)"; exit 0; fi

# ---------------------------------------------------------------- 1) DB
if [ "$need_db" = true ]; then
  echo "CREATE DATABASE $GAMES_DB" | psql_in postgres >/dev/null
  log "DB $GAMES_DB 생성"
fi

# ---------------------------------------------------------------- 2) .env + Guard 토큰
mkdir -p "$GAMES_DIR/web" "$GAMES_DIR/build/libs"
if [ "$need_env" = true ]; then
  umask 077
  GUARD_TOKEN="$(openssl rand -hex 32)"
  {
    echo "# 도로 게임 천국 서버 설정 (setup-games-server.sh 가 $TS 에 생성). 배포가 덮어쓰지 않는다."
    echo "DB_USER=$(env_get "$DORO_ENV" POSTGRES_USER)"
    echo "DB_PASSWORD=$(env_get "$BLOG_ENV" DB_PASSWORD)"
    echo "DORO_GUARD_SERVICE_TOKEN=$GUARD_TOKEN"
    echo "GAMES_SESSION_KEY=$(openssl rand -base64 32)"
    echo "GAMES_OAUTH_AUTHORIZE_URL=$ORIGIN/oauth2/authorize"
    echo "GAMES_OAUTH_REDIRECT_URI=$ORIGIN/games/api/v1/bff/callback"
  } > "$ENV_FILE"
  log "$ENV_FILE 생성 (값은 출력하지 않는다. GAMES_SESSION_KEY 를 잃으면 모든 로그인 세션이 무효가 된다)"
fi

# ---------------------------------------------------------------- 3) Guard 서비스 토큰
if [ "$need_token" = true ]; then
  TOKEN="$(env_get "$ENV_FILE" DORO_GUARD_SERVICE_TOKEN)"
  [ -n "$TOKEN" ] || die "$ENV_FILE 에 DORO_GUARD_SERVICE_TOKEN 이 없다"
  cp -p "$DORO_ENV" "$DORO_ENV.bak-games-$TS"
  grep -q '^DORO_GUARD_SERVICE_TOKENS=' "$DORO_ENV" || die "$DORO_ENV 에 DORO_GUARD_SERVICE_TOKENS 가 없다"
  sed -i "s|^DORO_GUARD_SERVICE_TOKENS=\(.*\)$|DORO_GUARD_SERVICE_TOKENS=\1,games:$TOKEN:schema-write|" "$DORO_ENV"
  grep -q "games:" "$DORO_ENV" || die "토큰 추가 실패. 복구: cp $DORO_ENV.bak-games-$TS $DORO_ENV"
  log "$DORO_ENV 에 games 토큰 추가 (백업: $DORO_ENV.bak-games-$TS)"
  (cd "$DORO_DIR" && docker compose up -d --no-deps "$GUARD_SERVICE") 2>&1 | tail -3
  until [ "$(docker inspect --format '{{.State.Health.Status}}' doro-guard-api 2>/dev/null || echo none)" = healthy ]; do
    [ $SECONDS -lt 120 ] || die "Guard 가 120초 안에 healthy 가 되지 않았다. 복구: cp $DORO_ENV.bak-games-$TS $DORO_ENV && cd $DORO_DIR && docker compose up -d --no-deps $GUARD_SERVICE"
    sleep 3
  done
  log "Guard 재생성 후 healthy"
fi

# ---------------------------------------------------------------- 4) OAuth 클라이언트
psql_in "$AUTH_DB" >/dev/null <<SQL
INSERT INTO oauth_clients (id, client_id, name, redirect_uris, allowed_scopes, is_active, first_party, created_at)
VALUES (gen_random_uuid(), '$CLIENT_ID', 'Doro Games', '$ORIGIN/games/api/v1/bff/callback', 'openid profile email', TRUE, TRUE, now())
ON CONFLICT (client_id) DO UPDATE SET redirect_uris = EXCLUDED.redirect_uris, is_active = TRUE, first_party = TRUE;
SQL
log "OAuth 클라이언트 등록: client_id=$CLIENT_ID, redirect_uri=$ORIGIN/games/api/v1/bff/callback, firstParty=true"

cat <<MSG

서버 준비 완료. 남은 일:
  1) 로컬에서 compose 파일 복사:  scp docker-compose.prod.yml mini:doro-games/
  2) 게이트웨이에 deploy/gateway-games.conf 반영 (docs/DEPLOY.md, CSP 는 Report-Only 로 먼저)
  3) 러너 등록 + 저장소 변수 CD_ENABLED=true (docs/DEPLOY.md)
MSG
