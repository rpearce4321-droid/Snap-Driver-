import { badRequest, json, requireDb, serverError } from "../_db";
import { getCookie, loadSession, verifyPassword, hashPassword } from "../_auth";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const token = getCookie(request, "sd_session");
  if (!token) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const session = await loadSession(env as any, token);
  if (!session) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let payload: { currentPassword?: string; newPassword?: string } = {};
  try {
    payload = (await request.json()) as { currentPassword?: string; newPassword?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const currentPassword = payload.currentPassword?.trim();
  const newPassword = payload.newPassword?.trim();
  if (!currentPassword || !newPassword) return badRequest("currentPassword and newPassword are required");
  if (newPassword.length < 8) return badRequest("Password must be at least 8 characters");

  try {
    const user = await db
      .prepare("SELECT id, password_hash FROM users WHERE id = ?")
      .bind(session.user_id)
      .first<any>();

    if (!user || !user.password_hash) {
      return badRequest("Account does not have a password set");
    }

    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) return badRequest("Current password is incorrect");

    const hash = await hashPassword(newPassword);
    await db
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(hash, user.id)
      .run();

    return json({ ok: true });
  } catch (err: any) {
    return serverError(err?.message || "Failed to change password");
  }
};
