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

  const query =
    "SELECT id, email, role, status, status_note, status_updated_at, created_at, updated_at, password_hash FROM users" +
    (role ? " WHERE role = ?" : "") +
    " ORDER BY created_at DESC";
  const rows = role
    ? await db.prepare(query).bind(role).all<any>()
    : await db.prepare(query).all<any>();

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
