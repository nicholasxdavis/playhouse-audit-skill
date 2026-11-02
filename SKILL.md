---
name: playhouse-audit
description: >-
  Lean deploy quality gate: Lighthouse 100s (mobile + desktop median), image
  compression, and a copy gate with zero em dashes and zero emoji. Writes one
  summary.json and deletes run bloat. Use for Lighthouse, PageSpeed, SEO,
  Core Web Vitals, compress images, pre-deploy QA, or playhouse. Wire the
  deploy workflow so the gate runs on every deployment.
---

# Playhouse Audit

Measure, fix, re-measure. Keep the gate simple. See [ATTRIBUTION.md](ATTRIBUTION.md).

## Targets

| Gate | Target |
| --- | --- |
| Performance / Accessibility / Best Practices / SEO | **100** each (Performance = median of >= 3 runs) |
| Copy | **0** em dashes / stand-ins, **0** emoji |
| Images | Compress when smaller; set dimensions to avoid CLS |
| Artifacts | Only `.playhouse-audit/summary.json` unless `--keep-lhr` |

Vitals while climbing Performance: LCP < 2.5s, CLS < 0.1, low TBT, TTFB < 800ms. Compare medians. Lock a11y / BP / SEO / copy first if needed.

## When to use

- Lighthouse / PageSpeed / "get 100s"
- Every-deploy quality gate
- Image weight / LCP
- Copy scrub (em dashes, emoji)
- SEO basics (title, meta, canonical, robots, sitemap)

## Deploy every time

1. Copy [templates/playhouse-deploy.yml](templates/playhouse-deploy.yml) to `.github/workflows/playhouse-deploy.yml`.
2. Point `PLAYHOUSE_SKILL_PATH` at this skill if needed.
3. CI runs `gate.mjs` after `npm run build` on every PR and main push.

Details: [references/ci-deploy.md](references/ci-deploy.md).

## Workflow

```
build production → gate.mjs (copy → compress → lighthouse)
  → fix failing IDs → re-gate until locked
```

```bash
cd playhouse-audit/scripts && npm install && pip install pillow

npm run build
node playhouse-audit/scripts/gate.mjs --cwd . --runs 3
# live URL: add --url https://example.com --skip-compress
```

Exit codes: `0` pass, `1` tool error, `2` bad args, `3` scores short, `4` copy fail.

Pieces: `check_copy.py`, `compress_assets.py`, `audit.mjs` (see [references/](references/)).

## Fix order

1. Copy ([copy-gate.md](references/copy-gate.md))
2. SEO / document setup
3. Accessibility
4. Best Practices
5. Performance + compression ([compression.md](references/compression.md), [fix-recipes.md](references/fix-recipes.md))

Sister skill for favicon / OG / mascot: `identity-creation`.

## Hygiene (no bloat)

- Default output is **one** file: `.playhouse-audit/summary.json`
- Each run **deletes** the previous `.playhouse-audit/` folder first
- Full Lighthouse JSON only with `--keep-lhr` (debug)
- Add `.playhouse-audit/` to the project `.gitignore`
- Do not commit LHCI temp uploads, chrome profiles, or session markdown

## Report (keep short)

```text
PLAYHOUSE: <url>  COPY: pass|fail
Desktop / Mobile medians: Perf Acc BP SEO
Top failing IDs → fixed this pass → remaining
STATUS: locked | climbing   CI workflow: yes|no
```

## Anti-patterns

- Auditing the Vite/Next **dev** server
- Single Performance run as "done"
- Keeping multi-MB `lhr-*.json` trees in git
- Skipping the deploy workflow
- Em-dash stand-ins or emoji in shipped copy
