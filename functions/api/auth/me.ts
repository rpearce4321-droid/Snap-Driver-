import { json, requireDb } from "../_db";
import { getCookie, loadSession } from "../_auth";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const token = getCookie(request, "sd_session");
  if (!token) return json({ ok: true, user: null });
  const session = await loadSession(env as any, token);
  if (!session) return json({ ok: true, user: null });
  return json({
    ok: true,
    user: {
      id: session.user_id,
      email: session.email,
      role: session.role,
      status: session.status,
    },
  });
};
