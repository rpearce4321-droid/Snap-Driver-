import { json, requireDb } from "../_db";

import { getCookie, loadSession } from "../_auth";
import { json, requireDb } from "../_db";

async function requireAdmin(request: Request, env: any) {
  const token = getCookie(request, "sd_session");
  if (!token) return null;
  const session = await loadSession(env as any, token);
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const admin = await requireAdmin(request, env as any);
  if (!admin) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rows = await db
    .prepare("SELECT id, label, created_at FROM seed_batches ORDER BY created_at DESC")
    .all<any>();
  let items = rows.results.map((row: any) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
  }));

  if (items.length === 0) {
    const fallback = await db
      .prepare(
        [
          "SELECT id, MAX(created_at) AS created_at FROM (",
          "  SELECT seed_batch_id AS id, created_at FROM seekers",
          "  WHERE is_seed = 1 AND seed_batch_id IS NOT NULL",
          "  UNION ALL",
          "  SELECT seed_batch_id AS id, created_at FROM retainers",
          "  WHERE is_seed = 1 AND seed_batch_id IS NOT NULL",
          ") GROUP BY id ORDER BY created_at DESC",
        ].join("\n")
      )
      .all<any>();
    items = fallback.results.map((row: any) => ({
      id: row.id,
      label: row.id ? `seed_${String(row.id).slice(0, 8)}` : "seed",
      createdAt: row.created_at,
    }));
  }
  return json({ items });
};
