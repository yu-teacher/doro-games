#!/usr/bin/env bash
# 서버(mini)에서 실행한다: 게이트웨이 nginx.conf 에 /games/assets/ (그림·목소리 서빙) location 하나만 넣는다. 멱등.
# apply-gateway-games.sh --refresh 는 게임 블록 전체를 조각 파일로 다시 쓰기 때문에, 운영 설정이 조각보다 앞서 있으면(예: BFF 로그인 설정)
# 그 부분을 지워 버린다. 이 스크립트는 다른 줄을 하나도 건드리지 않고 새 location 만 끼워 넣는다.
#
#   scp deploy/gateway-games.conf mini:doro-games/gateway-games.conf
#   ssh mini 'bash -s' < scripts/apply-gateway-assets.sh             # 검증만(nginx -t), 아무것도 바꾸지 않는다
#   ssh mini 'bash -s -- --apply' < scripts/apply-gateway-assets.sh  # 반영 + reload + 확인, 실패하면 백업으로 되돌린다
set -Eeuo pipefail

CONF="${GATEWAY_CONF:-$HOME/doro/gateway/nginx.conf}"
PIECE="${GAMES_PIECE:-$HOME/doro-games/gateway-games.conf}"
CONTAINER="${GATEWAY_CONTAINER:-doro-gateway}"
APPLY=false
for a in "$@"; do
  case "$a" in
    --apply) APPLY=true ;;
    *) echo "알 수 없는 옵션: $a" >&2; exit 2 ;;
  esac
done
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }
[ -f "$CONF" ] || die "$CONF 가 없다"
[ -f "$PIECE" ] || die "$PIECE 가 없다 (scp 로 먼저 복사한다)"
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "$CONTAINER 컨테이너가 없다"

grep -q "location /games/assets/ {" "$CONF" && { log "이미 반영돼 있다. 변경 없음"; exit 0; }

TS="$(date +%Y%m%d-%H%M%S)"
NEW="$(mktemp)"
trap 'rm -f "$NEW"' EXIT
python3 - "$CONF" "$PIECE" "$NEW" <<'PY'
import re, sys
conf_path, piece_path, out_path = sys.argv[1:4]
conf = open(conf_path, encoding="utf-8").read()
piece = open(piece_path, encoding="utf-8").read()

# 조각에서 /games/assets/ location 을 중괄호 짝을 맞춰 꺼낸다
m = re.search(r"location\s+/games/assets/\s*\{", piece)
if not m:
    sys.exit("조각 파일에 /games/assets/ location 이 없다")
depth, i = 1, m.end()
while i < len(piece) and depth:
    depth += {"{": 1, "}": -1}.get(piece[i], 0)
    i += 1
block = piece[m.start():i]

pad = " " * 8
lines = block.strip().splitlines()
out = [pad + lines[0].strip()]
nested = 0
for l in lines[1:]:
    s = l.strip()
    if not s:
        out.append("")
        continue
    if s == "}":
        nested -= 1 if nested > 0 else 0
        out.append(pad + "    " * nested + "}" if nested > 0 or len(out) < len(lines) else pad + "}")
        continue
    out.append(pad + "    " * (nested + 1) + s)
    nested += s.count("{") - s.count("}")
text = "\n".join(out)
# 마지막 닫는 괄호는 location 자신의 것이다
if not text.rstrip().endswith("}"):
    sys.exit("블록 모양이 올바르지 않다")

anchor = "        location /games/ {"
if conf.count(anchor) != 1:
    sys.exit("삽입 위치(location /games/ {)를 정확히 하나 찾지 못했다")
comment = "        # 도로 게임 천국 그림·목소리 (/games/assets/): 객체 저장소(MinIO) 공개 읽기 전용 버킷. deploy/gateway-games.conf 에서 옴\n"
conf = conf.replace(anchor, comment + text + "\n\n" + anchor, 1)
open(out_path, "w", encoding="utf-8").write(conf)
PY

docker cp "$NEW" "$CONTAINER:/tmp/nginx-assets-test.conf"
if docker exec "$CONTAINER" nginx -t -c /tmp/nginx-assets-test.conf; then log "새 설정 검증 통과(nginx -t)"; else docker exec "$CONTAINER" rm -f /tmp/nginx-assets-test.conf; die "새 설정 검증 실패. 아무것도 바꾸지 않았다"; fi
docker exec "$CONTAINER" rm -f /tmp/nginx-assets-test.conf
log "변경 내용(diff, 추가되는 줄만 있어야 한다):"
# diff 는 차이가 있으면 종료 코드 1 을 돌려주므로(set -e + pipefail) 출력 파이프는 || true 로 받는다
{ diff -u "$CONF" "$NEW" || true; } | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | cut -c1-110 || true
if { diff -u "$CONF" "$NEW" || true; } | grep -E '^-' | grep -vqE '^---'; then die "지워지는 줄이 있다. 중단"; fi
[ "$APPLY" = true ] || { log "검증만 하고 종료 (--apply 로 반영)"; exit 0; }

cp -p "$CONF" "$CONF.bak-assets-$TS"
cat "$NEW" > "$CONF"   # 같은 inode 로 덮어쓴다(컨테이너가 이 파일을 바로 마운트한다)
if docker exec "$CONTAINER" nginx -t && docker exec "$CONTAINER" nginx -s reload; then
  sleep 1
  r() { curl -sk -o /dev/null -w '%{http_code}' --resolve "localhost:443:127.0.0.1" "https://localhost$1" || echo 000; }
  games="$(r /games/)"; manifest="$(r /games/assets/manifest.json)"; api="$(r /games/api/v1/me)"; blog="$(r '/api/v1/posts?page=0&size=1')"
  log "확인: /games/=$games (200 기대), assets manifest=$manifest (200 기대), /games/api/v1/me=$api (401 기대), 블로그 API=$blog (200 기대)"
  if [ "$games" = 200 ] && [ "$manifest" = 200 ] && [ "$api" = 401 ] && [ "$blog" = 200 ]; then log "완료. 백업: $CONF.bak-assets-$TS"; exit 0; fi
  log "ERROR: 확인 실패. 백업으로 되돌린다"
else
  log "ERROR: 반영 실패. 백업으로 되돌린다"
fi
cat "$CONF.bak-assets-$TS" > "$CONF"
docker exec "$CONTAINER" nginx -s reload || true
die "되돌렸다. 백업: $CONF.bak-assets-$TS"
