import { badRequest, json, requireDb, serverError } from "../_db";
import { createMagicLink, originFromRequest } from "../_auth";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  let payload: { email?: string; role?: string } = {};
  try {
    payload = (await request.json()) as { email?: string; role?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const email = payload.email?.trim().toLowerCase();
  const role = payload.role?.trim().toUpperCase();
  if (!email || !role) return badRequest("email and role are required");
  if (!["ADMIN", "RETAINER", "SEEKER"].includes(role)) {
    return badRequest("Invalid role");
  }

  let user = await db
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .bind(email)
    .first<any>();

  if (!user) {
    const id = crypto.randomUUID();
    try {
      await db
        .prepare("INSERT INTO users (id, email, role, password_hash) VALUES (?, ?, ?, NULL)")
        .bind(id, email, role)
        .run();
      user = { id, email };
    } catch (err: any) {
      return serverError(err?.message || "Failed to create user");
    }
  }

  try {
    const magic = await createMagicLink(env as any, user.id, "SET_PASSWORD");
    const origin = originFromRequest(request);
    const magicUrl = `${origin}/set-password?token=${magic.token}`;

    return json({ ok: true, magicLink: magicUrl, expiresAt: magic.expiresAt });
  } catch (err: any) {
    return serverError(err?.message || "Failed to create magic link");
  }
};
