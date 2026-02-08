# Snap Driver - Runtime Baseline

This doc captures how the app is run today so we can keep dev and staging aligned.

## Runtime Layers
- Frontend: Vite + React (`src/`), local-first by default.
- Local API (dev): Express + Prisma (`server/`).
- Cloudflare Pages Functions (staging/prod): `functions/api/**` with D1 + R2.

## Choose Your API Stack
- Local Express API: best for quick local data browsing (seekers/retainers/admin KPIs).
- Cloudflare Functions API: required for auth, seed/sync, and production parity.
- Select the active API with `VITE_API_URL`:
  - Local Express: `VITE_API_URL=http://localhost:5175`
  - Cloudflare Pages (dev or deployed): `VITE_API_URL=<pages_url>`

## Local Development
- Run both web + API:
  - `npm run dev`
  - Starts Vite (default `http://localhost:5173`) and the local API (default `http://localhost:5175`).
- Run API only:
  - `npm run server`

## API Base URL
- `src/lib/api.ts` uses `import.meta.env.VITE_API_URL ?? "/api"`.
- In local dev, `.env.local` sets:
  - `VITE_API_URL=http://localhost:5175`
- If the API is down, browser requests will fail with `ERR_CONNECTION_REFUSED`.

## API Surface (Local Express)
- Source: `server/index.js` (and optional `server/admin.js` router).
- Implemented endpoints:
  - `GET /health`
  - `GET /seekers`
  - `GET /retainers`
  - `GET /admin/kpis`
- Note: Auth, seed, sync, and uploads are not implemented in Express.

## API Surface (Cloudflare Pages Functions)
- Source: `functions/api/**`
- Auth:
  - `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`
  - `/auth/invite`, `/auth/consume`
  - `/auth/reset`, `/auth/reset-consume`
  - `/auth/change`
- Admin:
  - `/admin/kpis`, `/admin/pending`, `/admin/approve`, `/admin/reject`
- Seed:
  - `/seed/load`, `/seed/batches`, `/seed/import`, `/seed/purge`, `/seed/wipe`
- Sync:
  - `/sync/pull`, `/sync/upsert`
- Profiles:
  - `/profile/lookup`
- Uploads:
  - `/uploads`, `/uploads/[key]`

## Ports and CORS
- Local API default port: `5175` (see `.env`).
- Vite default port: `5173`.
- CORS origin is set by `.env`:
  - `CORS_ORIGIN=http://localhost:5173`

## Databases and Storage
- Local API uses Postgres via Prisma:
  - `.env` contains `DATABASE_URL`.
- Cloudflare Pages uses D1 + R2:
  - `wrangler.toml` defines D1 binding `DB` and R2 binding `UPLOADS`.

## Wrangler + D1 Setup (Cloudflare)
- See `docs/instrutions.md` for the canonical setup steps:
  - Create D1 databases (prod + preview).
  - Add IDs to `wrangler.toml`.
  - Create R2 bucket.
  - Apply migrations with `wrangler d1 execute`.

## API Implementations
- Local API (Express): `server/index.js`
  - Provides `/seekers`, `/retainers`, `/admin/kpis`, and optional admin routes.
- Cloudflare Functions: `functions/api/**`
  - Auth: `/auth/*`
  - Admin: `/admin/*`
  - Seed/sync: `/seed/*`, `/sync/*`
  - Uploads: `/uploads/*`

## Local-First Data
- Most portals still use localStorage stores (see `docs/CONTEXT.md` for keys).
- Server sync is optional and uses:
  - `/api/sync/pull`
  - `/api/sync/upsert`

## Auth Behavior
- Admin login in `src/pages/AdminDashboardPage.tsx` calls `/auth/login` (Functions API).
- If the Functions API is not running, admin login will fail.
- A local admin session bypass exists for dev-only access (no API required).

## When Things Break
- `ERR_CONNECTION_REFUSED` to `:5175` means the local API is not running.
- `/api/*` calls will fail if `VITE_API_URL` is missing or points to the wrong port.
- `404` on `/auth/*` or `/sync/*` means you are hitting the Express API, not the Functions API.
