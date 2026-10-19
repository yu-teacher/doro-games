#!/usr/bin/env bash
# 가공한 게임 그림(build_game_assets.py 의 출력 폴더)을 MinIO 버킷에 올린다. 추가 도구 없이 curl(7.75+)의 SigV4 서명만 쓴다.
#
#   MINIO_ROOT_USER=... MINIO_ROOT_PASSWORD=... scripts/assets/upload-game-assets.sh web/public/art
#
# 서버의 MinIO 는 127.0.0.1 에만 열려 있으므로 서버에서 실행하거나(폴더를 scp 로 보낸 뒤) SSH 터널을 쓴다.
#   MINIO_ENDPOINT   기본 http://127.0.0.1:9000
#   GAMES_ASSETS_BUCKET 기본 doro-games-assets
#   GAMES_ASSETS_SKIP_POLICY=true  정책 API 가 없는 S3 목 서버로 시험할 때만 쓴다(운영에서는 쓰지 않는다)
# 하는 일: 버킷이 없으면 만들고, 읽기 전용 공개(GetObject 만) 정책을 건 뒤, 그림 파일을 올린다. manifest.json 은 맨 마지막에 올린다
#         (manifest 가 가리키는 파일이 모두 올라간 뒤에야 웹이 새 목록을 보게 하려는 것). 비밀번호는 출력하지 않는다.
set -Eeuo pipefail

DIR="${1:?그림 폴더 경로가 필요하다 (build_game_assets.py 의 --out)}"
ENDPOINT="${MINIO_ENDPOINT:-http://127.0.0.1:9000}"
BUCKET="${GAMES_ASSETS_BUCKET:-doro-games-assets}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER 가 필요하다}" "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD 가 필요하다}"
[ -f "$DIR/manifest.json" ] || { echo "$DIR/manifest.json 이 없다" >&2; exit 2; }
case "$BUCKET" in *[!a-z0-9.-]*|"") echo "버킷 이름이 올바르지 않다: $BUCKET" >&2; exit 2 ;; esac

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
s3() { curl -sS --aws-sigv4 "aws:amz:us-east-1:s3" --user "$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD" "$@"; }
status() { s3 -o /dev/null -w '%{http_code}' "$@"; }
content_type() {
  case "$1" in
    *.webp) echo image/webp ;; *.png) echo image/png ;; *.jpg|*.jpeg) echo image/jpeg ;;
    *.json) echo application/json ;; *) echo application/octet-stream ;;
  esac
}
upload() {
  local file="$1" name; name="$(basename "$1")"
  local code; code="$(status -X PUT -H "Content-Type: $(content_type "$name")" -T "$file" "$ENDPOINT/$BUCKET/$name")"
  [ "$code" = 200 ] || { echo "업로드 실패($code): $name" >&2; exit 1; }
  log "  올림: $name"
}

log "버킷 확인/생성: $BUCKET"
case "$(status -I "$ENDPOINT/$BUCKET")" in
  200) log "  이미 있다" ;;
  404) [ "$(status -X PUT "$ENDPOINT/$BUCKET")" = 200 ] || { echo "버킷을 만들지 못했다" >&2; exit 1; }; log "  만들었다" ;;
  *) echo "버킷 상태를 확인하지 못했다(엔드포인트·자격 증명 확인)" >&2; exit 1 ;;
esac

if [ "${GAMES_ASSETS_SKIP_POLICY:-false}" = true ]; then
  log "공개 정책 단계를 건너뛴다(시험용)"
else
POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::$BUCKET/*\"]}]}"
[ "$(status -X PUT --data "$POLICY" "$ENDPOINT/$BUCKET?policy")" = 204 ] || { echo "읽기 전용 공개 정책을 걸지 못했다" >&2; exit 1; }
log "읽기 전용 공개 정책 적용(GetObject 만)"
fi

for f in "$DIR"/*; do
  [ "$(basename "$f")" = manifest.json ] && continue
  [ -f "$f" ] && upload "$f"
done
upload "$DIR/manifest.json"
log "완료. 확인: curl -s $ENDPOINT/$BUCKET/manifest.json"
