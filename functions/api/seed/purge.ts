import { badRequest, json, requireDb, serverError } from "../_db";
import { getCookie, loadSession } from "../_auth";
import { badRequest, json, requireDb, serverError } from "../_db";

type PurgeRequest = {
  batchId?: string;
  all?: boolean;
};


async function requireAdmin(request: Request, env: any) {
  const token = getCookie(request, "sd_session");
  if (!token) return null;
  const session = await loadSession(env as any, token);
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

const seedTables = [
  "record_hall_entries",
  "reputation_scores",
  "badge_checkins",
  "badge_selections",
  "badge_definitions",
  "broadcasts",
  "posts",
  "route_interests",
  "routes",
  "messages",
  "conversations",
  "links",
  "subcontractors",
  "retainer_users",
  "seekers",
  "retainers",
  "users",
];

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const admin = await requireAdmin(request, env as any);
  if (!admin) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let payload: PurgeRequest = {};
  try {
    if (request.body) {
      payload = (await request.json()) as PurgeRequest;
    }
  } catch {
    return badRequest("Invalid JSON body");
  }

  const batchId = payload.batchId?.trim();
  if (!batchId && !payload.all) {
    return badRequest("Provide batchId or set all=true");
  }

  try {
    if (batchId) {
      for (const table of seedTables) {
        await db
          .prepare(`DELETE FROM ${table} WHERE is_seed = 1 AND seed_batch_id = ?`)
          .bind(batchId)
          .run();
      }
      await db.prepare("DELETE FROM seed_batches WHERE id = ?").bind(batchId).run();
    } else {
      for (const table of seedTables) {
        await db.prepare(`DELETE FROM ${table} WHERE is_seed = 1`).run();
      }
      await db.prepare("DELETE FROM seed_batches").run();
    }
  } catch (err: any) {
    return serverError(err?.message || "Failed to purge seed data");
  }

  return json({ ok: true, batchId: batchId ?? null });
};
