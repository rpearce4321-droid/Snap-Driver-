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

  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<any>();
  if (existing) return badRequest("An account already exists for that email");

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
