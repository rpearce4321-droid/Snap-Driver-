import { getCookie, loadSession } from "../../_auth";
import { json, requireDb } from "../../_db";
import { resolveRetainerForSession } from "../_retainer";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const token = getCookie(request, "sd_session");
  if (!token) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const session = await loadSession(env as any, token);
  if (!session || session.role !== "RETAINER") {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const retainer = await resolveRetainerForSession(db, session);
  if (!retainer) return json({ ok: false, error: "Retainer profile not found" }, { status: 400 });

  await db
    .prepare(
      "UPDATE google_oauth_tokens SET revoked_at = datetime('now'), updated_at = datetime('now') WHERE retainer_id = ?"
    )
    .bind(retainer.id)
    .run();

  return json({ ok: true });
};
