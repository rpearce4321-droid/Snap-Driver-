import { badRequest, json, requireDb, serverError } from "../_db";
import { getCookie, loadSession } from "../_auth";
import { badRequest, json, requireDb, serverError } from "../_db";

const WIPE_TABLES = [
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
  "magic_links",
  "sessions",
  "users",
  "seed_batches",
];

async function requireAdmin(request: Request, env: any) {
  const token = getCookie(request, "sd_session");
  if (!token) return null;
  const session = await loadSession(env as any, token);
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const admin = await requireAdmin(request, env as any);
  if (!admin) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let payload: { confirm?: string } = {};
  try {
    payload = (await request.json()) as { confirm?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  if ((payload.confirm || "").trim() !== "WIPE ALL") {
    return badRequest("Confirmation text mismatch");
  }

  try {
    for (const table of WIPE_TABLES) {
      await db.prepare(`DELETE FROM ${table}`).run();
    }
  } catch (err: any) {
    return serverError(err?.message || "Failed to wipe server data");
  }

  return json({ ok: true });
};
