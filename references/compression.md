# Asset compression (absorbed from compression-for-performance)

Lossless or near-lossless image compression for Core Web Vitals. Prefer correctly sized display dimensions before you compress.

## Script

```bash
python playhouse-audit/scripts/compress_assets.py path/to/assets
python playhouse-audit/scripts/compress_assets.py path/to/assets --jpeg-quality 85 --webp-quality 88
```

Requirements: Python 3 + Pillow (`pip install pillow`).

Behavior:
- Walks recursively for `.png`, `.jpg`, `.jpeg`, `.webp`
- Writes via a temp file and replaces the original only when smaller
- Prints a per-file table and total savings
- SVG/GIF: clean manually or with a dedicated SVG tool (not Pillow)

## Strategy

| Format | Approach |
| --- | --- |
| PNG | Lossless DEFLATE optimize, strip unnecessary metadata |
| JPEG | Progressive, optimized Huffman, full chroma (`4:4:4`), strip EXIF |
| WebP | High quality / near-lossless, max effort |
| SVG | Strip comments/metadata/redundant paths separately |

## Standards

- No perceptible loss (aim SSIM > 0.98 when validating critically)
- Strip EXIF / GPS unless the user needs color-critical ICC retention
- Always set HTML `width` / `height` (or aspect-ratio CSS) to avoid CLS
- Convert heavy PNG/JPEG heroes to WebP/AVIF when the stack supports it
- Do not crush design masters in place if they are canonical sources; target `public/` or built assets

## Done checklist

- [ ] Target directory scanned
- [ ] Script run successfully
- [ ] Savings reported
- [ ] Critical assets spot-checked visually
