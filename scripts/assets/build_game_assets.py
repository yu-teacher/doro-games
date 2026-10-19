#!/usr/bin/env python3
"""게임 그림을 가공해 manifest.json 과 함께 내보낸다. 그림 파일은 git 에 올리지 않는다(객체 저장소에 올린다).

  python3 scripts/assets/build_game_assets.py --source ../dororong-photos \\
      --spec scripts/assets/orange-blitz.sprites.json --out web/public/art [--preview preview.jpg]

스펙 파일(JSON)이 "어떤 원본을 어떻게 가공할지" 를 정한다. 원본 경로는 --source 기준의 상대 경로다.
  src      원본 파일(GIF 는 첫 프레임을 쓴다)
  crop     [x0, y0, x1, y1] 비율(0~1)로 자를 영역(선택)
  cutout   "adaptive"(바깥 배경 지우기) | "none"
  edges    배경 기준으로 삼을 가장자리 ["top","bottom","left","right"] (기본: 모두).
           그림이 이미지 가장자리에 닿아 있으면(잘린 상반신 등) 닿은 쪽을 빼야 몸까지 배경으로 착각하지 않는다
  height   (또는 width) 결과 크기(px). 비율은 유지한다
출력 파일 이름에는 내용 해시를 넣는다(영구 캐시해도 그림을 바꾸면 이름이 바뀐다).
필요: Pillow (pip install pillow)
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import time
from collections import Counter, deque
from pathlib import Path

from PIL import Image, ImageFilter

WORK_MAX = 420  # 가공 중 작업 크기(긴 변). 결과가 작아서 이 정도면 충분하고 빠르다
STEP_TOL = 14  # 이웃 픽셀과의 색 차이가 이 안이면 같은 배경 영역으로 이어 간다(그라데이션 배경용)
PALETTE_TOL = 60  # 테두리에서 뽑은 배경 색들과의 거리가 이 안이어야 배경이다
PALETTE_MIN_SHARE = 0.01  # 테두리 픽셀의 이 비율 이상을 차지하는 색만 배경 색으로 본다
ALPHA_FLOOR = 10
ALL_EDGES = ("top", "bottom", "left", "right")
SAFE_KEY = re.compile(r"^[a-z][a-z0-9-]*$")


def _dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def edge_pixels(im: Image.Image, edges: tuple[str, ...]) -> list[tuple[int, int]]:
    """고른 가장자리의 좌표들."""
    w, h = im.size
    coords: list[tuple[int, int]] = []
    if "top" in edges:
        coords += [(x, 0) for x in range(w)]
    if "bottom" in edges:
        coords += [(x, h - 1) for x in range(w)]
    if "left" in edges:
        coords += [(0, y) for y in range(h)]
    if "right" in edges:
        coords += [(w - 1, y) for y in range(h)]
    return coords


def border_palette(im: Image.Image, edges: tuple[str, ...] = ALL_EDGES) -> list[tuple[int, int, int]]:
    """고른 가장자리에서 흔한 색(배경 색 후보)을 뽑는다."""
    px = im.load()
    border = [px[x, y] for x, y in edge_pixels(im, edges)]
    counts = Counter((r >> 4, g >> 4, b >> 4) for r, g, b in border)
    keep = [k for k, n in counts.items() if n / len(border) >= PALETTE_MIN_SHARE]
    return [((r << 4) + 8, (g << 4) + 8, (b << 4) + 8) for r, g, b in keep]


def background_mask(im: Image.Image, edges: tuple[str, ...] = ALL_EDGES) -> bytearray:
    """고른 가장자리에서 이어지는 배경 픽셀을 1 로 표시한다. 검은 윤곽선처럼 색이 확 바뀌는 곳에서 멈춘다."""
    w, h = im.size
    px = im.load()
    palette = border_palette(im, edges)
    mask = bytearray(w * h)

    def near_palette(c: tuple[int, int, int]) -> bool:
        return any(_dist(c, p) <= PALETTE_TOL for p in palette)

    queue: deque[tuple[int, int]] = deque(edge_pixels(im, edges))
    seeded = set(queue)
    while queue:
        x, y = queue.popleft()
        i = y * w + x
        if mask[i]:
            continue
        here = px[x, y]
        if (x, y) in seeded and not near_palette(here):
            continue
        mask[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not mask[ny * w + nx]:
                n = px[nx, ny]
                if _dist(n, here) <= STEP_TOL and near_palette(n):
                    queue.append((nx, ny))
    return mask


def cut_out(im: Image.Image, edges: tuple[str, ...] = ALL_EDGES) -> Image.Image:
    """바깥 배경을 투명하게 만든다. 가장자리는 한 픽셀 깎고 살짝 흐려서 배경색 테두리를 줄인다."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    mask = background_mask(rgb, edges)
    alpha = Image.new("L", (w, h))
    alpha.putdata([0 if m else 255 for m in mask])
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def trim(im: Image.Image) -> Image.Image:
    alpha = im.getchannel("A").point(lambda v: 255 if v > ALPHA_FLOOR else 0)
    box = alpha.getbbox()
    return im.crop(box) if box else im


def load_first_frame(path: Path) -> Image.Image:
    im = Image.open(path)
    im.seek(0)
    return im.convert("RGBA")


def fit_work_size(im: Image.Image) -> Image.Image:
    scale = min(1.0, WORK_MAX / max(im.size))
    return im if scale >= 1 else im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)


MAX_FRAMES = 12


def sample_frames(path: Path, count: int) -> list[Image.Image]:
    """움직이는 그림(GIF·WebP)에서 count 장을 고르게 뽑는다. 장면이 모자라면 있는 만큼만."""
    with Image.open(path) as im:
        total = getattr(im, "n_frames", 1)
        count = max(1, min(count, MAX_FRAMES, total))
        picks = sorted({round(i * total / count) % total for i in range(count)})
        frames = []
        for index in picks:
            im.seek(index)
            frames.append(im.convert("RGBA"))
        return frames


def process_frames(entry: dict, source: Path) -> tuple[Image.Image, int]:
    """움직이는 그림을 장면마다 누끼를 따서 가로로 이어 붙인 시트로 만든다. (시트, 장면 수) 를 돌려준다."""
    src = (source / entry["src"]).resolve()
    if source.resolve() not in src.parents:
        raise ValueError(f"원본이 --source 밖을 가리킨다: {entry['src']}")
    method = entry.get("cutout", "none")
    if method not in ("adaptive", "rembg") or "height" not in entry:
        raise ValueError("frames 는 cutout=adaptive 또는 rembg 와 height 가 필요하다")
    edges = tuple(entry.get("edges", ALL_EDGES))
    cutter = rembg_cut if method == "rembg" else (lambda f: cut_out(f, edges))
    cut = [cutter(fit_work_size(f)) for f in sample_frames(src, int(entry["frames"]))]
    # 모든 장면이 같은 틀을 쓰도록 불투명한 영역의 합집합으로 자른다(그래야 움직일 때 몸이 덜덜 떨리지 않는다)
    boxes = [b for b in (f.getchannel("A").point(lambda v: 255 if v > ALPHA_FLOOR else 0).getbbox() for f in cut) if b]
    if boxes:
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        cut = [f.crop(box) for f in cut]
    scale = entry["height"] / cut[0].height
    size = (max(1, round(cut[0].width * scale)), entry["height"])
    sheet = Image.new("RGBA", (size[0] * len(cut), size[1]))
    for i, f in enumerate(cut):
        sheet.paste(f.resize(size, Image.LANCZOS), (i * size[0], 0))
    return sheet, len(cut)


_REMBG_SESSION = None


def rembg_cut(im: Image.Image) -> Image.Image:
    """rembg(애니메 모델)로 배경을 지운다. rembg 는 이 옵션을 쓸 때만 불러온다(선택 의존성)."""
    global _REMBG_SESSION
    try:
        from rembg import new_session, remove
    except ImportError as error:
        raise RuntimeError("cutout=rembg 에는 rembg 가 필요하다: pip install 'rembg[cpu]'") from error
    if _REMBG_SESSION is None:
        _REMBG_SESSION = new_session("isnet-anime")
    return remove(im, session=_REMBG_SESSION).convert("RGBA")


def process(entry: dict, source: Path) -> tuple[Image.Image, str]:
    """스펙 한 줄을 가공해 (이미지, 저장 형식) 을 돌려준다."""
    src = (source / entry["src"]).resolve()
    if source.resolve() not in src.parents:
        raise ValueError(f"원본이 --source 밖을 가리킨다: {entry['src']}")
    im = load_first_frame(src)
    crop = entry.get("crop")
    if crop:
        x0, y0, x1, y1 = crop
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
            raise ValueError(f"crop 비율이 올바르지 않다: {crop}")
        im = im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))
    cutout = entry.get("cutout", "none")
    edges = tuple(entry.get("edges", ALL_EDGES))
    if not edges or any(e not in ALL_EDGES for e in edges):
        raise ValueError(f"edges 는 {ALL_EDGES} 중에서 골라야 한다: {edges}")
    if cutout == "adaptive":
        im = trim(cut_out(fit_work_size(im), edges))
        fmt = "WEBP"
    elif cutout == "rembg":
        # 모양을 알아보는 AI 배경 제거. 복잡한 배경에서는 색 기준 방식보다 깔끔하지만 만화체는 가끔 몸을 지운다(미리보기로 확인할 것)
        im = trim(rembg_cut(fit_work_size(im)))
        fmt = "WEBP"
    elif cutout == "none":
        fmt = "WEBP"
    else:
        raise ValueError(f"알 수 없는 cutout: {cutout}")
    if "height" in entry:
        scale = entry["height"] / im.height
    elif "width" in entry:
        scale = entry["width"] / im.width
    else:
        raise ValueError("height 또는 width 가 필요하다")
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    return im, fmt


def encode(im: Image.Image, fmt: str) -> bytes:
    buffer = io.BytesIO()
    im.save(buffer, fmt, quality=88, method=6)
    return buffer.getvalue()


def build(spec: dict, source: Path, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    manifest: dict = {"version": int(time.time()), "sprites": {}, "variants": {}}

    def emit(key: str, entry: dict) -> dict:
        frames = 1
        if entry.get("frames", 1) > 1:
            im, frames = process_frames(entry, source)
            fmt = "WEBP"
        else:
            im, fmt = process(entry, source)
        data = encode(im, fmt)
        name = f"{key}-{hashlib.sha1(data).hexdigest()[:10]}.webp"
        (out / name).write_bytes(data)
        meta = {"file": name, "w": im.width // frames, "h": im.height}
        if frames > 1:
            meta["frames"] = frames
        return meta

    for key, entry in spec["sprites"].items():
        if not SAFE_KEY.match(key):
            raise ValueError(f"키 이름이 올바르지 않다: {key}")
        manifest["sprites"][key] = emit(key, entry)
    # 같은 역할의 그림 여러 장(배경 띠, 적 의상, 보스 모습). 게임이 번호로 골라 쓴다
    for key, entries in spec.get("variants", {}).items():
        if not SAFE_KEY.match(key):
            raise ValueError(f"키 이름이 올바르지 않다: {key}")
        manifest["variants"][key] = [emit(key, entry) for entry in entries]
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def preview(manifest: dict, out: Path, target: Path) -> None:
    """결과를 어두운 배경 위에 늘어놓아 눈으로 확인할 수 있게 한다."""
    cell = 220
    files = [m["file"] for m in manifest["sprites"].values()] + [m["file"] for v in manifest.get("variants", {}).values() for m in v]
    keys = list(range(len(files)))
    sheet = Image.new("RGB", (cell * min(4, len(keys)), cell * ((len(keys) + 3) // 4)), (30, 40, 60))
    for i, key in enumerate(keys):
        im = Image.open(out / files[key]).convert("RGBA")
        im.thumbnail((cell - 10, cell - 10))
        sheet.paste(im, ((i % 4) * cell + 5, (i // 4) * cell + 5), im)
    sheet.save(target, quality=85)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args(argv)
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    manifest = build(spec, args.source, args.out)
    for key, meta in manifest["sprites"].items():
        print(f"{key:8s} {meta['file']}  {meta['w']}x{meta['h']}")
    for key, metas in manifest["variants"].items():
        for i, meta in enumerate(metas):
            print(f"{key}[{i}]".ljust(8) + f" {meta['file']}  {meta['w']}x{meta['h']}")
    if args.preview:
        preview(manifest, args.out, args.preview)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
