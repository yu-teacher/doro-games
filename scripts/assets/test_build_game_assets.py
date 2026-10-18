"""build_game_assets.py 의 단위 테스트. 실행: python3 -m unittest scripts/assets/test_build_game_assets.py (Pillow 필요)"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
import build_game_assets as b  # noqa: E402


def sample(path: Path, background=(255, 255, 255)) -> None:
    """배경 위에 검은 윤곽선이 있는 빨간 원."""
    im = Image.new("RGB", (120, 120), background)
    d = ImageDraw.Draw(im)
    d.ellipse((30, 30, 90, 90), fill=(220, 40, 40), outline=(0, 0, 0), width=3)
    im.save(path)


class CutoutTest(unittest.TestCase):
    def test_바깥_배경은_투명하고_안쪽_그림은_남는다(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "a.png"
            sample(src)
            out = b.cut_out(Image.open(src))
            self.assertEqual(out.getpixel((2, 2))[3], 0)
            self.assertEqual(out.getpixel((60, 60))[3], 255)

    def test_그라데이션_배경도_지운다(self):
        im = Image.new("RGB", (120, 120))
        for y in range(120):
            for x in range(120):
                im.putpixel((x, y), (60, 150 + y // 6, 255))
        ImageDraw.Draw(im).ellipse((30, 30, 90, 90), fill=(250, 250, 250), outline=(0, 0, 0), width=3)
        out = b.cut_out(im)
        self.assertEqual(out.getpixel((2, 2))[3], 0)
        self.assertEqual(out.getpixel((117, 117))[3], 0)
        self.assertEqual(out.getpixel((60, 60))[3], 255)

    def test_trim_은_그림_영역만_남긴다(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "a.png"
            sample(src)
            trimmed = b.trim(b.cut_out(Image.open(src)))
            self.assertLess(trimmed.width, 120)
            self.assertLess(trimmed.height, 120)


class BuildTest(unittest.TestCase):
    def test_manifest_와_해시_이름_파일이_만들어진다(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            sample(root / "src" / "hero.png")
            spec = {"sprites": {"hero": {"src": "hero.png", "cutout": "adaptive", "height": 40}, "bg": {"src": "hero.png", "cutout": "none", "width": 60}}}
            manifest = b.build(spec, root / "src", root / "out")
            self.assertEqual(set(manifest["sprites"]), {"hero", "bg"})
            self.assertEqual(manifest["sprites"]["hero"]["h"], 40)
            self.assertEqual(manifest["sprites"]["bg"]["w"], 60)
            written = json.loads((root / "out" / "manifest.json").read_text())
            for key, meta in written["sprites"].items():
                self.assertRegex(meta["file"], rf"^{key}-[0-9a-f]{{10}}\.webp$")
                self.assertTrue((root / "out" / meta["file"]).exists())

    def test_같은_입력이면_파일_이름이_같다(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            sample(root / "src" / "a.png")
            spec = {"sprites": {"hero": {"src": "a.png", "cutout": "adaptive", "height": 40}}}
            first = b.build(spec, root / "src", root / "o1")
            second = b.build(spec, root / "src", root / "o2")
            self.assertEqual(first["sprites"]["hero"]["file"], second["sprites"]["hero"]["file"])

    def test_원본_폴더_밖을_가리키면_거절한다(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            sample(root / "outside.png")
            with self.assertRaises(ValueError):
                b.process({"src": "../outside.png", "cutout": "none", "height": 10}, root / "src")

    def test_잘못된_키와_옵션은_거절한다(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            sample(root / "src" / "a.png")
            with self.assertRaises(ValueError):
                b.build({"sprites": {"../evil": {"src": "a.png", "height": 10}}}, root / "src", root / "o")
            with self.assertRaises(ValueError):
                b.process({"src": "a.png", "cutout": "magic", "height": 10}, root / "src")
            with self.assertRaises(ValueError):
                b.process({"src": "a.png", "crop": [0.5, 0.5, 0.2, 0.9], "height": 10}, root / "src")
            with self.assertRaises(ValueError):
                b.process({"src": "a.png"}, root / "src")


if __name__ == "__main__":
    unittest.main()
