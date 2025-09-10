Cloudflare Worker: /api/stats
=================================

This worker provides a tiny key-value counter API under your own domain to power live view/member stats without third-party CORS/DNS issues.

Endpoints
- GET /api/stats/get/:namespace/:key → { value }
- GET /api/stats/hit/:namespace/:key → increments by 1 → { value }
- GET /api/stats/create?namespace=..&key=..&value=.. → creates if missing → { value }
- GET /api/stats/update?namespace=..&key=..&amount=.. → adds amount (can be negative) → { value }

All responses are JSON with CORS headers for GET.

Quick Setup
1) Install Wrangler
   npm i -g wrangler

2) Create a KV namespace
   cd cloudflare/stats-worker
   wrangler kv:namespace create STATS
   wrangler kv:namespace create STATS --preview
   Copy the produced IDs into wrangler.toml (id and preview_id).

3) Configure wrangler.toml
   - Replace YOUR_ACCOUNT_ID with your Cloudflare account id (wrangler whoami)
   - Easiest: deploy under your free workers.dev subdomain (workers_dev = true). No domain or business plan required.
   - Optional: later, if you add your domain to Cloudflare, uncomment the routes entry to serve under your domain.

4) Deploy
   wrangler deploy

5) Verify
   Using workers.dev (example):
   curl https://YOUR-NAME.unstable.workers.dev/api/stats/hit/thechurchofunity.com/site-views
   curl https://YOUR-NAME.unstable.workers.dev/api/stats/get/thechurchofunity.com/members

6) Point the site to your worker URL
   - Add a meta tag to your pages (or set it once via site/meta.js):
     <meta name="stats-endpoint" content="https://YOUR-NAME.workers.dev/api/stats">

Notes
- The site code (site/stats.js) reads the stats endpoint from a single meta tag and does not use any third-party fallbacks. All calls go to your Worker.
