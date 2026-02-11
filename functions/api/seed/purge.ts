import { badRequest, json, requireDb, serverError } from "../_db";
import { getCookie, loadSession } from "../_auth";
import { badRequest, json, requireDb, serverError } from "../_db";

type PurgeRequest = {
  batchId?: string;
  all?: boolean;
  legacy?: boolean;
};

const LEGACY_JSON_PATTERNS = [
  '%"isDemo":true%',
  '%"isDemo": true%',
  '%"demoLabel"%',
  '%"photoUrl":"data:image%',
  '%"profileImageUrl":"data:image%',
  '%"logoUrl":"data:image%',
  '%"companyPhotoUrl":"data:image%',
  '%"vehiclePhoto1":"data:image%',
  '%"vehiclePhoto2":"data:image%',
  '%"vehiclePhoto3":"data:image%',
];
const LEGACY_NAME_PATTERN = "%*%";

async function getTableColumns(db: D1Database, table: string): Promise<Set<string>> {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all<any>();
  return new Set((info.results ?? []).map((row: any) => row.name));
}

async function deleteLegacyRows(db: D1Database, table: string) {
  const columns = await getTableColumns(db, table);
  const clauses: string[] = [];
  const params: any[] = [];
  if (columns.has("is_seed")) {
    clauses.push("is_seed = 1");
  }
  if (columns.has("seed_batch_id")) {
    clauses.push("seed_batch_id IS NOT NULL");
  }
  if (columns.has("data_json")) {
    for (const pattern of LEGACY_JSON_PATTERNS) {
      clauses.push("data_json LIKE ?");
      params.push(pattern);
    }
  }
  if (columns.has("last_name")) {
    clauses.push("last_name LIKE ?");
    params.push(LEGACY_NAME_PATTERN);
  }
  if (columns.has("ceo_name")) {
    clauses.push("ceo_name LIKE ?");
    params.push(LEGACY_NAME_PATTERN);
  }
  if (clauses.length === 0) return;
  await db.prepare(`DELETE FROM ${table} WHERE ${clauses.join(" OR ")}`).bind(...params).run();
}

async function deleteBatchRows(db: D1Database, table: string, batchId: string) {
  const columns = await getTableColumns(db, table);
  if (!columns.has("seed_batch_id")) return;
  await db.prepare(`DELETE FROM ${table} WHERE seed_batch_id = ?`).bind(batchId).run();
}


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
  "route_assignments",
  "work_unit_periods",
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
  const legacy = payload.legacy ?? true;
  if (!batchId && !payload.all) {
    return badRequest("Provide batchId or set all=true");
  }

  try {
    if (batchId) {
      for (const table of seedTables) {
        await deleteBatchRows(db, table, batchId);
      }
      await db.prepare("DELETE FROM seed_batches WHERE id = ?").bind(batchId).run();
    } else {
      for (const table of seedTables) {
        if (legacy) {
          await deleteLegacyRows(db, table);
        } else {
          const columns = await getTableColumns(db, table);
          if (columns.has("is_seed")) {
            await db.prepare(`DELETE FROM ${table} WHERE is_seed = 1`).run();
          }
        }
      }
      await db.prepare("DELETE FROM seed_batches").run();
    }
  } catch (err: any) {
    return serverError(err?.message || "Failed to purge seed data");
  }

  return json({ ok: true, batchId: batchId ?? null });
};
