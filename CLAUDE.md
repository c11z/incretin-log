# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Two-part app: a Cloudflare Worker API backed by D1 (SQLite), and a static frontend on GitHub Pages.

- **`worker/src/index.ts`** — Single-file API. Routes are matched manually (no router library). `GET /api/entries` is public; `POST`, `PUT /api/entries/:date`, and `DELETE /api/entries/:date` require `Authorization: Bearer <token>` checked against the `API_TOKEN` worker secret. Computed fields (BMI, WtHR, WoW diff, % change, mean change) are calculated server-side in `computeFields()` using hardcoded height constants (170cm).
- **`site/`** — TypeScript frontend built with esbuild. Source is `site/src/app.ts`, built to `site/app.js` (gitignored). Charts use Vega-Lite (loaded from CDN). The API base URL is hardcoded in `app.ts`. The API key for writes is stored in `localStorage` under `incretinApiKey`.
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

Frontend commands run from `site/`:

```bash
npm run build      # compile TypeScript to site/app.js (esbuild)
npm run watch      # rebuild on changes
npm run typecheck  # run tsc --noEmit
```

## Deployment

- **Worker**: `npm run deploy` from `worker/`. D1 database ID is in `worker/wrangler.toml`.
- **Frontend**: Auto-deploys `site/` to GitHub Pages on push to `main` via `.github/workflows/deploy-pages.yml`.

## Key Constants

- Height: 170cm (used for BMI and WtHR calculations in `worker/src/index.ts`)
- Goals: weight 75kg (initial), weight 69kg (stretch), WtHR 50%, waist 85cm (rendered as chart goal lines in `site/src/app.ts`)
- BMI zones: Healthy <25, Overweight 25-30, Obese >30

## Color Palette

All colors must come from the **Okabe-Ito** palette (colorblind-safe). No other colors should be introduced.

| Name | Hex | CSS Variable | TS Constant |
|------|-----|-------------|-------------|
| Black | `#000000` | `--oi-black` | — |
| Orange | `#E69F00` | `--oi-orange` | `OI.orange` |
| Sky Blue | `#56B4E9` | `--oi-sky-blue` | `OI.skyBlue` |
| Bluish Green | `#009E73` | `--oi-bluish-green` | `OI.bluishGreen` |
| Yellow | `#F0E442` | `--oi-yellow` | `OI.yellow` |
| Blue | `#0072B2` | `--oi-blue` | `OI.blue` |
| Vermilion | `#D55E00` | `--oi-vermilion` | `OI.vermilion` |
| Reddish Purple | `#CC79A7` | `--oi-reddish-purple` | `OI.reddishPurple` |

CSS variables are defined in `:root` in `site/style.css`. TS constants are in the `OI` object in `site/src/app.ts`. Use variables/constants — never raw hex values outside their definitions.
