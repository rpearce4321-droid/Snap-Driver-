import { getCookie, loadSession } from "../_auth";

import { getCookie, loadSession } from "../_auth";
import { badRequest, json, requireDb } from "../_db";

const allowedRoles = new Set(["ADMIN", "SEEKER", "RETAINER"]);

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

  const role = new URL(request.url).searchParams.get("role")?.toUpperCase() ?? "";
  if (role && !allowedRoles.has(role)) {
    return badRequest("Invalid role");
  }

  const queryBase =
    "SELECT id, email, role, status, status_note, status_updated_at, created_at, updated_at, password_hash FROM users" +
    (role ? " WHERE role = ?" : "") +
    " ORDER BY created_at DESC";
  const fallbackQuery =
    "SELECT id, email, role, status, created_at, updated_at, password_hash FROM users" +
    (role ? " WHERE role = ?" : "") +
    " ORDER BY created_at DESC";

  let rows: { results: any[] };
  try {
    rows = role
      ? await db.prepare(queryBase).bind(role).all<any>()
      : await db.prepare(queryBase).all<any>();
  } catch (err: any) {
    // Backward-compatible fallback when status_note/status_updated_at columns are missing.
    rows = role
      ? await db.prepare(fallbackQuery).bind(role).all<any>()
      : await db.prepare(fallbackQuery).all<any>();
  }

  const items = (rows?.results ?? []).map((row: any) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    statusNote: row.status_note ?? null,
    statusUpdatedAt: row.status_updated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    passwordSet: Boolean(row.password_hash),
    source: "server",
  }));

  return json({ items });
};
