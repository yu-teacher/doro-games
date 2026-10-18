# 게임 그림(에셋) 관리

게임 그림은 **git 에 올리지 않는다.** 가공한 파일을 객체 저장소(MinIO)의 공개 읽기 전용 버킷에 두고, 게이트웨이가 `/games/assets/` 로 그대로 전달한다.
그림이 없어도 게임은 돈다(도형으로 대신 그린다). 그래서 CI·테스트·새 개발 환경에는 그림이 필요 없다.

## 흐름
```
원본 모음 ──(build_game_assets.py)──▶ web/public/assets/ (git 제외) ──(upload-game-assets.sh)──▶ MinIO doro-games-assets
                                                                                      ▲
브라우저 ── /games/assets/manifest.json, *.webp ── 게이트웨이(/games/assets/) ─────────┘
```

- `scripts/assets/orange-blitz.sprites.json`: **어떤 원본을 어떻게 가공할지**(잘라낼 영역, 배경 제거, 크기). 이 파일만 git 에 있다.
- `build_game_assets.py`: 배경 제거(바깥 배경만 지움, 그림이 이미지 가장자리에 닿아 있으면 스펙의 `edges` 로 기준 가장자리를 고른다), 트리밍, 크기 조정 후 **내용 해시가 붙은 이름**으로 저장하고 `manifest.json`(키 → 파일) 을 만든다. 같은 입력이면 같은 이름이 나온다.
- `upload-game-assets.sh`: 버킷 생성, 읽기 전용 공개 정책(GetObject 만), 업로드. **manifest 를 맨 마지막에 올린다.**
- 웹(`web/src/games/orange/assets.ts`): 시작할 때 manifest 를 읽어 그림을 불러온다. 알 수 없는 키, 경로를 벗어난 파일 이름, 외부 주소는 버린다.

## 로컬 개발
```bash
pip install pillow
python3 scripts/assets/build_game_assets.py --source ../dororong-photos \
    --spec scripts/assets/orange-blitz.sprites.json --out web/public/assets --preview /tmp/preview.jpg
cd web && npm run dev      # /games/assets/ 를 Vite 가 web/public/assets 에서 바로 서빙한다
```
`--preview` 는 결과를 어두운 배경 위에 늘어놓은 확인용 이미지를 만든다. 스프라이트가 마음에 안 들면 스펙의 `crop`·`src` 를 고쳐 다시 만든다.

## 서버에 올리기 (그림을 바꿀 때만)
MinIO 는 서버의 127.0.0.1 에만 열려 있어서 서버에서 업로드를 실행한다.
```bash
rsync -a web/public/assets/ mini:doro-games-assets/
ssh mini 'set -a; . ~/doro-blog/.env; set +a; MINIO_ROOT_USER="${MINIO_ROOT_USER:-doro_admin}" bash -s -- ~/doro-games-assets' \
    < scripts/assets/upload-game-assets.sh
```
게이트웨이에 `/games/assets/` 가 아직 없다면 한 번만 반영한다(CSP 는 기존대로).
```bash
scp deploy/gateway-games.conf mini:doro-games/gateway-games.conf
ssh mini 'bash -s -- --dry-run' < scripts/apply-gateway-games.sh               # 먼저 검증만
ssh mini 'bash -s -- --apply --refresh --report-only' < scripts/apply-gateway-games.sh
```
그림을 바꿔 다시 올리면 파일 이름의 해시가 바뀌고 manifest 가 새 이름을 가리키므로 브라우저 캐시를 따로 지울 필요가 없다.

## 새 그림을 게임에 추가하려면
1. 스펙의 `sprites` 에 키를 추가한다(키는 `web/src/games/orange/assets.ts` 의 `SpriteKey` 에 있어야 한다).
2. 위 순서로 만들고 올린다. 그림이 없는 키는 `render.ts` 의 도형(placeholder)으로 그려진다.

## 알아 둘 점
- 이 저장소는 공개이므로 그림 파일 자체는 올리지 않는다. 그림의 **사용 권한은 올리는 사람이 책임진다.**
- 배경 제거는 "테두리에서 이어지는 배경" 만 지운다. 잘린 상반신처럼 그림이 이미지 가장자리에 닿아 있으면 몸의 색이 배경 색으로 잡혀 지워질 수 있어서, 하늘 쪽만 쓰도록 `"edges": ["top"]` 처럼 지정한다(보스가 그렇다). 그림 속 구멍(팔 사이 등)은 남고, 배경과 비슷한 색이 윤곽선 없이 맞닿으면 번질 수 있어서 결과를 `--preview` 로 확인한다.
- 스크립트 테스트: `python3 -m unittest scripts/assets/test_build_game_assets.py` (Pillow 필요, CI 에는 포함하지 않았다).

## 목소리
`scripts/assets/build-voices.sh` 가 고른 샘플을 `voice-cute/cheer/star/sigh.m4a` 로 복사한다(그림과 같은 곳에 올린다). 파일이 없으면 효과음만 난다.
효과음과 배경음은 파일이 아니라 `web/src/games/orange/audio.ts` 에서 합성한다. 목소리 음원(macOS 내장 음성)의 재배포 조건은 확인하지 못했으므로 공개 배포 전에 점검한다.
