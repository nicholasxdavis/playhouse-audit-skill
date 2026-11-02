# Fix Recipes (by Lighthouse category)

Apply only the audits that failed in `summary.json`. Prefer production builds. Re-audit after each batch of related fixes.

## Performance (target 100)

| Common audit / symptom | Fix |
| --- | --- |
| `largest-contentful-paint` | Preload LCP image (`fetchpriority="high"`). Serve correctly sized WebP/AVIF. Compress via `scripts/compress_assets.py` (see [compression.md](compression.md)). Avoid late hero swaps. |
| `cumulative-layout-shift` | Set `width`/`height` or `aspect-ratio` on images, video, embeds, ads. Reserve space for fonts/dynamic widgets. Prefer `font-display: optional` or swap with fallback metrics matched. |
| `total-blocking-time` / long tasks | Code-split vendors. Defer non-critical JS. Idle-load auth/analytics. Facades for YouTube/Maps. |
| `unused-javascript` / `unused-css` | Tree-shake, dynamic import routes, purge unused CSS, drop dead deps. |
| `render-blocking-resources` | Inline critical CSS carefully or defer non-critical CSS. Non-blocking font load (`preload` + `media="print" onload`). |
| `server-response-time` / TTFB | Cache, CDN, lighter SSR, edge static where possible. Local audits must use gzip (the runner does). |
| `uses-responsive-images` | `srcset`/`sizes`, do not ship 4000px into a 400px slot. |
| `modern-image-formats` | WebP/AVIF with fallbacks. |
| `bootup-time` / `mainthread-work-breakdown` | Reduce hydration cost, split charts/editors, avoid heavy sync work on load. |
| Entry JS too large | Keep initial chunk lean (aim &lt; ~90KB gzip for critical path). Manual vendor chunks (charts, motion, three, icons). |
| Heavy WebGL / mascot engines | Do not block LCP. Show a static WebP first. Idle-load or click-to-boot the live engine (see Tako pattern). |
| Google Fonts CSS chain | Self-host woff2 with `font-display: optional` or swap. Avoid render-blocking CSS from fonts.googleapis.com when chasing 100. |
| `*-insight` audits still listed while category is 100 | Noise. Fix only IDs that move a category score or a vital. Do not chase insight footnotes once medians are locked. |

Image weight: run compression inside this skill (`gate.mjs` or `compress_assets.py`). See [compression.md](compression.md).

## Copy (required before ship)

| Symptom | Fix |
| --- | --- |
| Em dash / `--` / spaced hyphen pause | Recast with comma, colon, period, or parentheses. See [copy-gate.md](copy-gate.md). |
| Emoji wallpaper in headers/CTAs | Remove decorative emoji; keep at most the budget (`--max-emoji`, prefer 0). |
| Checker false positives in code | Fenced/inline code and URLs are skipped; move prose out of code spans if needed. |

## Accessibility (target 100)

| Common audit | Fix |
| --- | --- |
| `color-contrast` | Meet 4.5:1 normal text, 3:1 large text. Avoid light gray on white and white on gold/yellow. |
| `image-alt` | Meaningful `alt` or `alt=""` for decorative. |
| `button-name` / `link-name` | Accessible name on every control. Icon-only buttons need `aria-label`. |
| `document-title` | Unique descriptive `<title>`. |
| `html-has-lang` | `<html lang="...">`. |
| `heading-order` | One `h1`. No level skips (`h1`→`h2`→`h3`). |
| `label` | Every input associated with a `<label>` or `aria-label`. |
| `target-size` | Adequate tap targets on mobile. |
| `aria-*` misuse | Prefer native elements. ARIA must match behavior. |

## Best Practices (target 100)

| Common audit | Fix |
| --- | --- |
| `external-anchors-use-rel-noopener` | `rel="noopener noreferrer"` on `target="_blank"`. |
| `errors-in-console` | Eliminate runtime errors and noisy deprecations in production. |
| `doctype` / `charset` | `<!DOCTYPE html>` and `<meta charset="utf-8">`. |
| `is-on-https` | HTTPS in production; no mixed content. |
| `image-aspect-ratio` | Displayed ratio matches intrinsic. |
| Vulnerable libs | Update deps flagged by audits / npm audit for ship-blocking CVEs. |

## SEO (target 100)

| Common audit / gap | Fix |
| --- | --- |
| `document-title` | 30-60 char unique title with primary topic. |
| `meta-description` | 120-160 char unique description. |
| `http-status-code` | 200 for indexable pages. |
| `link-text` | Descriptive anchors (not "click here"). |
| `crawlable-anchors` | Real `<a href>` navigation, not click-only `div`s. |
| `robots-txt` / blocked | Do not disallow critical HTML/CSS/JS. |
| `hreflang` | Only if multi-locale; keep consistent. |
| `canonical` | Absolute canonical per page. |
| Viewport | `<meta name="viewport" content="width=device-width, initial-scale=1">`. |
| Structured data | Valid JSON-LD (`Organization`, `WebSite`, `SoftwareApplication`, `FAQPage`, etc.) when relevant. |
| Open Graph / Twitter | `og:*` and `twitter:*` with 1200×630 image (see `identity-creation` OG lane). |
| Favicon | Present icons (see `identity-creation` favicon lane). |
| Sitemap / robots | `sitemap.xml` referenced from `robots.txt`. |

## Page setup checklist (always)

- [ ] Production build audited (not only HMR dev server)
- [ ] Mobile + desktop median scores recorded
- [ ] Title, description, canonical, robots, viewport
- [ ] One `h1`, logical headings
- [ ] Images: alt, dimensions, modern format, compressed, lazy below fold
- [ ] OG/Twitter + favicon
- [ ] `robots.txt` + sitemap for public sites
- [ ] No console errors on load
- [ ] Copy gate clean (no em dashes; emoji within budget)
- [ ] `.github/workflows/playhouse-deploy.yml` present so every deploy runs the gate
- [ ] Visual check after perf changes (no broken layout)
