# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Two-part app: a Cloudflare Worker API backed by D1 (SQLite), and a static frontend on GitHub Pages.

- **`worker/src/index.ts`** — Single-file API. Routes are matched manually (no router library). `GET /api/entries` is public; `POST`, `PUT /api/entries/:date`, and `DELETE /api/entries/:date` require `Authorization: Bearer <token>` checked against the `API_TOKEN` worker secret. Computed fields (BMI, WHtR, WoW diff, % change, mean change) are calculated server-side in `computeFields()` using hardcoded height constants (170cm).
- **`site/`** — Vanilla HTML/CSS/JS, no build step. Charts use Vega-Lite (loaded from CDN). The API base URL is hardcoded in `app.js`. The API key for writes is stored in `localStorage` under `incretinApiKey`.
- **`schema.sql` / `seed.sql`** — D1 schema and historical data. Applied via `wrangler d1 execute`.

## Commands

All commands run from `worker/`:

```bash
npm run dev        # local dev server with D1 emulation (wrangler dev)
npm run deploy     # deploy worker to Cloudflare (wrangler deploy)
```

D1 database operations:

```bash
npx wrangler d1 execute incretin-log-db --remote --file=../schema.sql
npx wrangler d1 execute incretin-log-db --remote --file=../seed.sql
npx wrangler secret put API_TOKEN
```

The frontend has no build/test commands — open `site/index.html` directly or view via GitHub Pages.

## Deployment

- **Worker**: `npm run deploy` from `worker/`. D1 database ID is in `worker/wrangler.toml`.
- **Frontend**: Auto-deploys `site/` to GitHub Pages on push to `main` via `.github/workflows/deploy-pages.yml`.

## Key Constants

- Height: 170cm (used for BMI and WHtR calculations in `worker/src/index.ts`)
- Goals: WHtR 50%, waist 85cm (rendered as chart goal lines in `site/app.js`)
- BMI zones: Healthy <25, Overweight 25-30, Obese >30
