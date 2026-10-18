#!/usr/bin/env bash
# 고른 목소리 샘플을 게임이 찾는 이름(voice-*.m4a)으로 복사한다. 결과 폴더는 upload-game-assets.sh 로 올린다(git 에는 두지 않는다).
# 사용: scripts/assets/build-voices.sh <샘플 폴더(.private/voice-samples)> <결과 폴더>
set -euo pipefail
SRC="${1:?샘플 폴더}"; OUT="${2:?결과 폴더}"
mkdir -p "$OUT"
copy() { [ -f "$SRC/$2" ] || { echo "없음: $SRC/$2" >&2; exit 2; }; cp "$SRC/$2" "$OUT/$1"; echo "$1 <- $2"; }
copy voice-cute.m4a  foreign/zh-meijia-1.m4a
copy voice-cheer.m4a foreign/en-goodnews-1.m4a
copy voice-star.m4a  foreign/en-superstar-1.m4a
copy voice-sigh.m4a  en-samantha-1.m4a
