import { hashPassword, getCookie, loadSession } from "../../_auth";
import { getCookie, hashPassword, loadSession } from "../../_auth";
import { badRequest, json, requireDb } from "../../_db";

async function requireAdmin(request: Request, env: any) {
  const token = getCookie(request, "sd_session");
  if (!token) return null;
  const session = await loadSession(env as any, token);
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const admin = await requireAdmin(request, env as any);
  if (!admin) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let payload: { userId?: string; email?: string; password?: string } = {};
  try {
    payload = (await request.json()) as {
      userId?: string;
      email?: string;
      password?: string;
    };
  } catch {
    return badRequest("Invalid JSON body");
  }

  const userId = payload.userId?.trim();
  const email = payload.email?.trim().toLowerCase();
  const password = payload.password?.trim() ?? "";

  if (!userId && !email) return badRequest("userId or email is required");
  if (!password) return badRequest("password is required");
  if (password.length < 8) return badRequest("Password must be at least 8 characters");

  const user = await db
    .prepare("SELECT id FROM users WHERE id = ? OR email = ?")
    .bind(userId ?? "", email ?? "")
    .first<any>();

  if (!user) return badRequest("User not found");

  const hash = await hashPassword(password);
  await db
    .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(hash, user.id)
    .run();

  return json({ ok: true });
};
