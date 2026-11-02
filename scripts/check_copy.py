#!/usr/bin/env python3
"""Gate shipped copy: zero em dashes (and stand-ins), zero emoji by default.

Usage:
  python check_copy.py path/to/file.html path/to/dir
  python check_copy.py --cwd .
  echo "draft" | python check_copy.py

Exits 1 on any em-dash / stand-in hit, or when a file exceeds --max-emoji
(default 0). Skips fenced code, inline code, URLs, node_modules, and build dirs.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

EM_DASH = "\u2014"
EN_DASH = "\u2013"
HORIZONTAL_BAR = "\u2015"

GENERIC_FIX = (
    "Replace with a comma, semicolon, colon, period, or parentheses, "
    "and recast the sentence if a plain swap reads awkwardly."
)

# Broad emoji coverage: pictographs, symbols, flags, skin tones, ZWJ sequences.
EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\U0001FA00-\U0001FAFF"
    "\U00002600-\U000026FF"
    "\U00002700-\U000027BF"
    "\U0001F1E0-\U0001F1FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\U0000231A-\U0000231B"
    "\U000023E9-\U000023F3"
    "\U000023F8-\U000023FA"
    "\U000025AA-\U000025AB"
    "\U000025B6"
    "\U000025C0"
    "\U000025FB-\U000025FE"
    "\U00002B05-\U00002B07"
    "\U00002B1B-\U00002B1C"
    "\U00002B50"
    "\U00002B55"
    "\U00003030"
    "\U0000303D"
    "\U00003297"
    "\U00003299"
    "\U0000FE0F"
    "\U0000200D"
    "]+",
    flags=re.UNICODE,
)

DEFAULT_EXTS = {
    ".html",
    ".htm",
    ".md",
    ".mdx",
    ".txt",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".vue",
    ".svelte",
    ".css",
    ".scss",
    ".astro",
}

SKIP_DIR_NAMES = {
    "node_modules",
    ".git",
    "dist",
    "out",
    "build",
    ".next",
    ".nuxt",
    ".playhouse-audit",
    "__pycache__",
    ".wobnimo",
    "coverage",
}


def mask_code_and_urls(line: str) -> str:
    masked = list(line)

    def blank(match: re.Match[str]) -> None:
        for i in range(match.start(), match.end()):
            masked[i] = " "

    for m in re.finditer(r"`[^`]*`", line):
        blank(m)
    for m in re.finditer(r"https?://\S+", line):
        blank(m)
    for m in re.finditer(r"\S+/\S+", line):
        blank(m)
    # CSS custom properties and CLI-style flags: --token (not a prose dash)
    for m in re.finditer(r"--[A-Za-z_][\w-]*", line):
        blank(m)
    return "".join(masked)


def is_markdown_dash_structure(line: str) -> bool:
    stripped = line.strip()
    if re.fullmatch(r"-{3,}", stripped):
        return True
    if "|" in stripped and "-" in stripped and re.fullmatch(r"[\s|:-]+", stripped):
        return True
    return False


def find_dash_hits(line: str):
    scan = mask_code_and_urls(line)
    for ch in (EM_DASH, HORIZONTAL_BAR):
        start = 0
        while True:
            idx = scan.find(ch, start)
            if idx == -1:
                break
            yield idx, ch, GENERIC_FIX
            start = idx + 1

    for m in re.finditer(rf"(?<=[^\W\d])\s*{EN_DASH}\s*(?=[^\W\d])", scan):
        yield m.start(), m.group(), "En dash used as a pause. " + GENERIC_FIX

    # Prose stand-ins only: word--word or a spaced " -- " pause.
    # Do not flag CSS vars / CLI flags (masked above) or "--" glued to a token.
    for m in re.finditer(r"(?<=\w)--(?=\w)|(?<=\s)--(?=\s)", scan):
        yield m.start(), m.group(), "Double hyphen used as a dash. " + GENERIC_FIX

    for m in re.finditer(r"(?<=[^\W\d])\s-\s(?=[^\W\d])", scan):
        yield m.start(), m.group(), "Spaced hyphen used as a pause. " + GENERIC_FIX


def count_emoji(text: str) -> int:
    # Count grapheme-ish clusters via the regex matches (ZWJ sequences count as one match).
    return len(EMOJI_RE.findall(text))


def check_text(text: str, *, max_emoji: int) -> tuple[list[tuple], int]:
    hits: list[tuple] = []
    in_fence = False
    for line_no, line in enumerate(text.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if is_markdown_dash_structure(line):
            continue
        for col, matched, fix in find_dash_hits(line):
            hits.append((line_no, col + 1, matched, fix))
    emoji_count = count_emoji(text)
    return hits, emoji_count if emoji_count > max_emoji else 0


def iter_files(paths: list[Path], exts: set[str]) -> list[Path]:
    files: list[Path] = []
    for p in paths:
        if p.is_file():
            if p.suffix.lower() in exts or not exts:
                files.append(p)
            continue
        if not p.is_dir():
            continue
        for child in p.rglob("*"):
            if not child.is_file():
                continue
            if any(part in SKIP_DIR_NAMES for part in child.parts):
                continue
            if child.suffix.lower() in exts:
                files.append(child)
    return sorted(set(files))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", type=Path, help="Files or directories")
    parser.add_argument("--cwd", type=Path, default=None, help="Project root to scan")
    parser.add_argument(
        "--max-emoji",
        type=int,
        default=0,
        help="Max emoji clusters allowed per file (default 0)",
    )
    parser.add_argument(
        "--ext",
        action="append",
        default=[],
        help="Extra extension to include (repeatable), e.g. --ext .astro",
    )
    args = parser.parse_args()

    exts = set(DEFAULT_EXTS)
    for e in args.ext:
        exts.add(e if e.startswith(".") else f".{e}")

    sources: list[tuple[str, str]] = []
    if args.paths or args.cwd:
        roots = list(args.paths)
        if args.cwd:
            roots.append(args.cwd)
        for path in iter_files(roots, exts):
            try:
                sources.append((str(path), path.read_text(encoding="utf-8")))
            except (OSError, UnicodeDecodeError) as exc:
                print(f"skip {path}: {exc}", file=sys.stderr)
    else:
        sources.append(("<stdin>", sys.stdin.read()))

    if not sources:
        print("No files to check.", file=sys.stderr)
        return 2

    total_dash = 0
    total_emoji_files = 0

    for label, text in sources:
        hits, emoji_over = check_text(text, max_emoji=args.max_emoji)
        for line_no, col_no, matched, fix in hits:
            shown = matched.strip() or matched
            print(f"{label}:{line_no}:{col_no}: found '{shown}'")
            print(f"  fix: {fix}")
        total_dash += len(hits)
        if emoji_over:
            total_emoji_files += 1
            n = count_emoji(text)
            print(
                f"{label}: excessive emoji ({n} > max {args.max_emoji}). "
                "Remove decorative emoji from shipped copy."
            )

    if total_dash or total_emoji_files:
        parts = []
        if total_dash:
            noun = "issue" if total_dash == 1 else "issues"
            parts.append(f"{total_dash} dash {noun}")
        if total_emoji_files:
            noun = "file" if total_emoji_files == 1 else "files"
            parts.append(f"{total_emoji_files} {noun} over emoji budget")
        print(f"\nCopy gate failed: {', '.join(parts)}.")
        return 1

    print(f"Clean: {len(sources)} source(s), no em dashes, emoji within budget.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
