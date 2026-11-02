# Deploy CI

Run playhouse on every PR and every push to main. Shape adapted from [lighthouse-skill CI](https://github.com/nimajafari/lighthouse-skill) and common LHCI / GitHub Actions practice.

## Entrypoint

```bash
node path/to/playhouse-audit/scripts/gate.mjs --cwd . --runs 3
node path/to/playhouse-audit/scripts/gate.mjs --url https://preview.example.com --skip-compress
```

Order: copy gate → compress (local) → Lighthouse median. Lean artifact: `summary.json` only.

## Install

Copy [templates/playhouse-deploy.yml](../templates/playhouse-deploy.yml) to `.github/workflows/playhouse-deploy.yml`.

Optional: set `PLAYHOUSE_SKILL_PATH` or `PLAYHOUSE_URL` (preview).

## Notes

- Gate **TBT** in lab, not INP (field-only).
- Median of >= 3 runs for Performance.
- Audit production builds only.
- Ignore `.playhouse-audit/` in git.
