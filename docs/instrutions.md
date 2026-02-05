# Instructions

## Cloudflare setup (D1 + R2)
- Install Wrangler: `npm i -D wrangler`
- Login: `npx wrangler login`
- Create D1 databases:
  - `npx wrangler d1 create snapdriver`
  - `npx wrangler d1 create snapdriver-preview`
- Add the IDs to `wrangler.toml` under `[[d1_databases]]`.
- Enable R2 in the Cloudflare dashboard, then:
  - `npx wrangler r2 bucket create snapdriver-uploads`

## D1 migrations (remote)
- Apply schema:
  - `npx wrangler d1 execute snapdriver --remote --file migrations/0001_init.sql`
  - `npx wrangler d1 execute snapdriver --remote --file migrations/0002_seed_flags.sql`
  - `npx wrangler d1 execute snapdriver --remote --file migrations/0003_system_settings.sql`
- Apply to preview:
  - `npx wrangler d1 execute snapdriver --remote --file migrations/0001_init.sql --preview`
  - `npx wrangler d1 execute snapdriver --remote --file migrations/0002_seed_flags.sql --preview`
  - `npx wrangler d1 execute snapdriver --remote --file migrations/0003_system_settings.sql --preview`

## Pages/Functions
- Functions live in `functions/` and provide `/api/*` routes for:
  - auth (invite/login/reset)
  - seed batches (create/import/purge)
  - admin KPIs
  - seekers/retainers CRUD (basic list + create)

## Admin portal: Server & Seed panel
- Open Admin > `Server & Seed`.
- Create a seed batch (optional label).
- Use **Include data sets** to choose what gets imported.
- Click **Import Local Seed** to push current local demo data to D1.
- Use **Purge Selected** or **Purge All** to remove seeded data.
- **Danger Zone**:
  - Type `WIPE ALL` and click **Wipe Server Data** to clear all D1 data.
  - **Wipe Local Cache** clears browser data (optional auto-wipe after server wipe).
- Use **Magic Link Invites** to create account invite links or reset links.

## Local seed export source
- `src/lib/serverSeed.ts` exports local demo data from localStorage into a payload for `/api/seed/import`.
- Badge data uses `getBadgeSelections`, `getBadgeCheckins`, and score history.

## Notes
- `/api` base URL is used by `src/lib/api.ts`.
- If testing locally, point `VITE_API_URL` to the deployed Pages URL or run a Pages dev server.

## Server sync
- App auto-pulls server data on load if /api is reachable.
- Admin > Server & Seed: use Pull/Push + toggles for Server Sync and Seed Mode.
- Seed Mode marks pushes as seed data so they can be purged later.
