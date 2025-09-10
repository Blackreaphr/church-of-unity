Deployment Notes (Cache Busting + Worker)

Always do this after tweaking site files:

- Stamp HTML: updates all pages to load `/site/meta.js?v=<version>`
  - `npm run stamp`             # stamps root + dist
  - or set custom: `BUILD_VERSION=YYYYMMDDHHmm npm run stamp`
- Build with stamping (dist only):
  - `npm run build`             # postbuild hook stamps `dist/` automatically
  - or `npm run build:stamp`    # does build and stamping in one command

Why this matters:
- `site/meta.js` auto-loads `site/stats.js` with the same version query, so both update together without users clearing cache.
- The Cloudflare Worker already sets `Cache-Control: no-store` for API responses.

Worker deploy (for stats/recovery):
- Configure once: `wrangler secret put RECOVERY_SECRET`
- Deploy options:
  - `npm run deploy:worker`     # deploys Worker using its wrangler.toml
  - `npm run deploy`            # build, stamp all HTML, then deploy Worker

Quick verify after deploy:
- Network tab: meta.js/stats.js URLs include `?v=...` you just stamped.
- API calls under `/api/stats/*` show `Cache-Control: no-store`.
- Recovery: on a joined device, “Get Recovery Code” returns a code.

File references
- HTML tag: `index.html` (and all `*.html`) → `<script type="module" src="/site/meta.js?v=...">`
- Stamping script: `scripts/stamp-version.mjs`
- Worker: `cloudflare/stats-worker/src/index.js`, `cloudflare/stats-worker/wrangler.toml`

---

Hostinger deploy (GitHub Actions)

Automated deploys to Hostinger happen on push to `main`/`master` via `.github/workflows/deploy-hostinger.yml`.

Setup (once, in GitHub repo → Settings → Secrets and variables → Actions):
- `HST_HOST`: Host/IP from Hostinger SSH
- `HST_USER`: SSH username
- `HST_PASS`: SSH password
- `HST_PORT`: SSH port (Hostinger uses a high port)
- `HST_REMOTE_DIR`: Remote web root (e.g. `/home/<user>/domains/<domain>/public_html/`)

What it does:
- Checks out code, installs deps, runs `npm run build:stamp`.
- Preflight SFTP check lists `HST_REMOTE_DIR` to validate your secrets.
- Uploads `dist/` to `HST_REMOTE_DIR` over SFTP, excludes dev files, deletes removed files.

Manual run:
- GitHub → Actions → Deploy to Hostinger (SFTP) → Run workflow.

Troubleshooting:
- If the job fails at “Preflight SFTP”, verify the five HST_* secrets. Most common issue is `HST_REMOTE_DIR`.
- Example Hostinger path: `/home/<user>/domains/thechurchofunity.com/public_html/`
- You can confirm the exact path in hPanel → Files → File Manager → click `public_html` → Properties.
