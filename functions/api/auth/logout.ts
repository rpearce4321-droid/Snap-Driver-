import { json } from "../_db";
import { clearSessionCookie, getCookie, revokeSession } from "../_auth";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const token = getCookie(request, "sd_session");
  if (token) {
    try {
      await revokeSession(env as any, token);
    } catch {
      // Always clear the cookie even if revocation fails.
    }
  }
  const cookie = clearSessionCookie(request.url.startsWith("https"));
  return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
};
