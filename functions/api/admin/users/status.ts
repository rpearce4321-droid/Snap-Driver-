import { getCookie, loadSession } from "../../_auth";
import { requireDb } from "../../_db";
import { badRequest, json } from "../../_helpers";

const ALLOWED_STATUSES = new Set(["ACTIVE", "SUSPENDED"]);

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

  let payload: { userId?: string; email?: string; status?: string; note?: string } = {};
  try {
    payload = (await request.json()) as {
      userId?: string;
      email?: string;
      status?: string;
      note?: string;
    };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const userId = payload.userId?.trim();
  const email = payload.email?.trim().toLowerCase();
  const status = payload.status?.trim().toUpperCase() ?? "";
  const note = payload.note?.trim() || null;

  if (!userId && !email) return badRequest("userId or email is required");
  if (!status || !ALLOWED_STATUSES.has(status)) return badRequest("Invalid status");

  const user = await db
    .prepare("SELECT id FROM users WHERE id = ? OR email = ?")
    .bind(userId ?? "", email ?? "")
    .first<any>();
  if (!user) return badRequest("User not found");

  await db
    .prepare(
      "UPDATE users SET status = ?, status_note = ?, status_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    )
    .bind(status, note, user.id)
    .run();

  return json({ ok: true });
};
