import { badRequest, json, requireDb } from "../_db";
import { createSession, sessionCookie, verifyPassword } from "../_auth";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  let payload: { email?: string; password?: string } = {};
  try {
    payload = (await request.json()) as { email?: string; password?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const email = payload.email?.trim().toLowerCase();
  const password = payload.password ?? "";
  if (!email || !password) return badRequest("email and password are required");

  const user = await db
    .prepare("SELECT id, email, password_hash, role, status FROM users WHERE email = ?")
    .bind(email)
    .first<any>();
  if (!user || !user.password_hash) return badRequest("Invalid credentials");

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return badRequest("Invalid credentials");

  const session = await createSession(env as any, user.id);
  const cookie = sessionCookie(session.token, request.url.startsWith("https"));

  return json(
    { ok: true, user: { id: user.id, email: user.email, role: user.role, status: user.status } },
    { headers: { "Set-Cookie": cookie } }
  );
};
