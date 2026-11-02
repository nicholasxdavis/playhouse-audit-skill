#!/usr/bin/env python3
"""Batch-compress web image assets with Pillow (PNG / JPEG / WebP)."""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from pathlib import Path

from PIL import Image


SUPPORTED = {".png", ".jpg", ".jpeg", ".webp"}


def compress_png(src: Path, dst: Path, compress_level: int = 9) -> None:
    with Image.open(src) as img:
        img.save(dst, "PNG", optimize=True, compress_level=compress_level)


def compress_jpeg(src: Path, dst: Path, quality: int = 85) -> None:
    with Image.open(src) as img:
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(
            dst,
            "JPEG",
            quality=quality,
            optimize=True,
            progressive=True,
            subsampling=0,
        )


def compress_webp(src: Path, dst: Path, quality: int = 88, lossless: bool = False) -> None:
    with Image.open(src) as img:
        img.save(
            dst,
            "WEBP",
            quality=quality,
            method=6,
            lossless=lossless,
        )


def compress_one(path: Path, jpeg_quality: int, webp_quality: int) -> tuple[int, int]:
    original_size = path.stat().st_size
    ext = path.suffix.lower()

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        if ext == ".png":
            compress_png(path, tmp_path)
        elif ext in {".jpg", ".jpeg"}:
            compress_jpeg(path, tmp_path, quality=jpeg_quality)
        elif ext == ".webp":
            compress_webp(path, tmp_path, quality=webp_quality)
        else:
            return original_size, original_size

        new_size = tmp_path.stat().st_size
        if new_size < original_size:
            shutil.move(str(tmp_path), str(path))
            return original_size, new_size

        tmp_path.unlink(missing_ok=True)
        return original_size, original_size
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise


def process_directory(
    directory: Path,
    jpeg_quality: int,
    webp_quality: int,
) -> None:
    total_orig = 0
    total_new = 0
    count = 0

    print(f"Compressing assets in: {directory}\n")
    print(f"{'File':<50} | {'Original':>10} | {'Compressed':>10} | {'Savings':>8}")
    print("-" * 90)

    for path in sorted(directory.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED:
            continue
        try:
            orig_b, new_b = compress_one(path, jpeg_quality, webp_quality)
        except Exception as exc:  # noqa: BLE001
            print(f"Error processing {path.name}: {exc}")
            continue

        saved = orig_b - new_b
        savings = f"{(saved / orig_b) * 100:.1f}%" if orig_b else "0.0%"
        total_orig += orig_b
        total_new += new_b
        count += 1
        rel = str(path.relative_to(directory))[:48]
        print(
            f"{rel:<50} | {orig_b/1024:>8.1f}KB | {new_b/1024:>8.1f}KB | {savings:>8}"
        )

    print("-" * 90)
    if total_orig > 0:
        overall = ((total_orig - total_new) / total_orig) * 100
        print(f"Processed {count} files.")
        print(f"Total Original:   {total_orig / (1024 * 1024):.2f} MB")
        print(f"Total Compressed: {total_new / (1024 * 1024):.2f} MB")
        print(f"Total Space Saved: {overall:.2f}%")
    else:
        print("No supported image files found.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        type=Path,
        help="Directory to scan recursively",
    )
    parser.add_argument("--jpeg-quality", type=int, default=85)
    parser.add_argument("--webp-quality", type=int, default=88)
    args = parser.parse_args()

    if not args.directory.is_dir():
        print(f"error: not a directory: {args.directory}", file=sys.stderr)
        return 2

    process_directory(args.directory, args.jpeg_quality, args.webp_quality)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
