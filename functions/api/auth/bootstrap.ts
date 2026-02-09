import { badRequest, json, requireDb, serverError } from "../_db";
import { createSession, hashPassword, sessionCookie } from "../_auth";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const expectedToken = (env as any).ADMIN_BOOTSTRAP_TOKEN?.trim();
  if (!expectedToken) {
    return badRequest("Bootstrap is not enabled");
  }

  let payload: { email?: string; password?: string; token?: string } = {};
  try {
    payload = (await request.json()) as { email?: string; password?: string; token?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const headerToken = request.headers.get("x-bootstrap-token")?.trim();
  const token = headerToken || payload.token?.trim() || "";
  if (!token) return badRequest("Bootstrap token is required");
  if (token !== expectedToken) return badRequest("Invalid bootstrap token");

  const existingAdmin = await db
    .prepare("SELECT id FROM users WHERE role = 'ADMIN' AND password_hash IS NOT NULL LIMIT 1")
    .first<any>();
  if (existingAdmin) return badRequest("Admin already exists");

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim();
  if (!email || !password) return badRequest("email and password are required");
  if (!EMAIL_RE.test(email)) return badRequest("Invalid email");
  if (password.length < 8) return badRequest("Password must be at least 8 characters");

  const existing = await db
    .prepare("SELECT id, role, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<any>();

  try {
    if (existing) {
      if (existing.password_hash) return badRequest("An account already exists for that email");
      if (existing.role && existing.role !== "ADMIN") return badRequest("Account role mismatch");
      const hash = await hashPassword(password);
      await db
        .prepare("UPDATE users SET password_hash = ?, role = 'ADMIN', updated_at = datetime('now') WHERE id = ?")
        .bind(hash, existing.id)
        .run();

      const session = await createSession(env as any, existing.id);
      const cookie = sessionCookie(session.token, request.url.startsWith("https"));
      return json(
        { ok: true, user: { id: existing.id, email, role: "ADMIN" } },
        { headers: { "Set-Cookie": cookie } }
      );
    }

    const id = crypto.randomUUID();
    const hash = await hashPassword(password);
    await db
      .prepare("INSERT INTO users (id, email, role, password_hash) VALUES (?, ?, 'ADMIN', ?)")
      .bind(id, email, hash)
      .run();

    const session = await createSession(env as any, id);
    const cookie = sessionCookie(session.token, request.url.startsWith("https"));
    return json(
      { ok: true, user: { id, email, role: "ADMIN" } },
      { headers: { "Set-Cookie": cookie } }
    );
  } catch (err: any) {
    return serverError(err?.message || "Failed to bootstrap admin");
  }
};
