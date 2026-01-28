import { badRequest, json, requireDb } from "../_db";
import { createMagicLink, originFromRequest } from "../_auth";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  let payload: { email?: string } = {};
  try {
    payload = (await request.json()) as { email?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const email = payload.email?.trim().toLowerCase();
  if (!email) return badRequest("email is required");

  const user = await db
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .bind(email)
    .first<any>();
  if (!user) return badRequest("No account found for that email");

  const magic = await createMagicLink(env as any, user.id, "RESET_PASSWORD");
  const origin = originFromRequest(request);
  const magicUrl = `${origin}/reset-password?token=${magic.token}`;

  return json({ ok: true, magicLink: magicUrl, expiresAt: magic.expiresAt });
};
