# Copy gate

Zero em dashes. Zero emoji. Patterns adapted from [skill-no-em-dashes](https://github.com/exmergo/skill-no-em-dashes), [deslop-the-copy](https://github.com/skyzer/deslop-the-copy), and [unslop](https://github.com/munzzyy/unslop).

## Rules

1. No em dash (U+2014) in shipped prose.
2. No stand-ins: `word--word`, spaced ` -- `, en dash (U+2013) between words, horizontal bar (U+2015).
3. Prefer comma, semicolon, colon, period, or parentheses. Recast when needed.
4. No emoji in scanned files (default `--max-emoji 0`).

Leave alone: hyphenated compounds, number/date ranges, code, URLs, paths, Markdown table rules, fenced code.

## Checker

```bash
python playhouse-audit/scripts/check_copy.py --cwd .
python playhouse-audit/scripts/check_copy.py index.html src --max-emoji 0
```

Wired into `gate.mjs` before Lighthouse. Exit `1` on failure.
