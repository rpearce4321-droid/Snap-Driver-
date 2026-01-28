import { json, requireDb } from "../_db";
import { clearSessionCookie, getCookie, loadSession, revokeSession } from "../_auth";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const token = getCookie(request, "sd_session");
  if (token) {
    await revokeSession(env as any, token);
  }
  const cookie = clearSessionCookie(request.url.startsWith("https"));
  return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
};
