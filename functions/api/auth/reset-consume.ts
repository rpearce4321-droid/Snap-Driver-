import { badRequest, json, requireDb, serverError } from "../_db";
import { consumeMagicLink, hashPassword } from "../_auth";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  let payload: { token?: string; password?: string } = {};
  try {
    payload = (await request.json()) as { token?: string; password?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const token = payload.token?.trim();
  const password = payload.password?.trim();
  if (!token || !password) return badRequest("token and password are required");
  if (password.length < 8) return badRequest("Password must be at least 8 characters");

  const magic = await consumeMagicLink(env as any, token, "RESET_PASSWORD");
  if (!magic) return badRequest("Invalid or expired token");

  try {
    const hash = await hashPassword(password);
    await db
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(hash, magic.userId)
      .run();
    return json({ ok: true });
  } catch (err: any) {
    return serverError(err?.message || "Failed to reset password");
  }
};
