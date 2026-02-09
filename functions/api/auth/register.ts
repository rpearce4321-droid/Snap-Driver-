import { badRequest, json, requireDb, serverError } from "../_db";
import { createSession, hashPassword, sessionCookie } from "../_auth";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  let payload: { email?: string; password?: string; role?: string } = {};
  try {
    payload = (await request.json()) as { email?: string; password?: string; role?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();
  const role = payload.role?.trim().toUpperCase();
  if (!email || !password || !role) return badRequest("email, password, role are required");
  if (!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(email)) return badRequest("Invalid email");
  if (password.length < 8) return badRequest("Password must be at least 8 characters");
  if (!['ADMIN', 'SEEKER', 'RETAINER'].includes(role)) return badRequest("Invalid role");
  const host = new URL(request.url).hostname;
  const isLocalHost =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  if (role === "ADMIN" && !isLocalHost) {
    return badRequest("Admin registration is disabled. Use bootstrap.");
  }

  const existing = await db.prepare("SELECT id, role, password_hash FROM users WHERE email = ?").bind(email).first<any>();
  if (existing) {
    if (existing.role && existing.role !== role) {
      return badRequest("Account role mismatch");
    }
    if (existing.password_hash) {
      return badRequest("An account already exists for that email");
    }
    const hash = await hashPassword(password);
    await db
      .prepare("UPDATE users SET password_hash = ?, role = COALESCE(role, ?), updated_at = datetime('now') WHERE id = ?")
      .bind(hash, role, existing.id)
      .run();

    const session = await createSession(env as any, existing.id);
    const cookie = sessionCookie(session.token, request.url.startsWith("https"));

    return json(
      { ok: true, user: { id: existing.id, email, role } },
      { headers: { "Set-Cookie": cookie } }
    );
  }

  try {
    const id = crypto.randomUUID();
    const hash = await hashPassword(password);
    await db
      .prepare("INSERT INTO users (id, email, role, password_hash) VALUES (?, ?, ?, ?)")
      .bind(id, email, role, hash)
      .run();

    const session = await createSession(env as any, id);
    const cookie = sessionCookie(session.token, request.url.startsWith("https"));

    return json(
      { ok: true, user: { id, email, role } },
      { headers: { "Set-Cookie": cookie } }
    );
  } catch (err: any) {
    return serverError(err?.message || "Failed to register user");
  }
};
