import { getCookie, loadSession } from "../../_auth";
import { json, requireDb } from "../../_db";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const token = getCookie(request, "sd_session");
  if (!token) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const session = await loadSession(env as any, token);
  if (!session || session.role !== "RETAINER") {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const retainer = await db
    .prepare("SELECT id FROM retainers WHERE user_id = ?")
    .bind(session.user_id)
    .first<any>();
  if (!retainer) return json({ ok: false, error: "Retainer profile not found" }, { status: 400 });

  const row = await db
    .prepare(
      "SELECT access_token, refresh_token, expires_at, revoked_at FROM google_oauth_tokens WHERE retainer_id = ?"
    )
    .bind(retainer.id)
    .first<any>();

  const connected = Boolean(row && !row.revoked_at && row.refresh_token);
  return json({ ok: true, connected, expiresAt: row?.expires_at ?? null });
};
