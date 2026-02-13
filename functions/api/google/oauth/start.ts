import { getCookie, loadSession, originFromRequest } from "../../_auth";
import { badRequest, json, requireDb, serverError } from "../../_db";
import { resolveRetainerForSession } from "../_retainer";

const STATE_COOKIE = "sd_google_oauth_state";

function stateCookie(value: string, secure: boolean) {
  const parts = [
    `${STATE_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${10 * 60}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const token = getCookie(request, "sd_session");
  if (!token) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const session = await loadSession(env as any, token);
  if (!session || session.role !== "RETAINER") {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const retainer = await resolveRetainerForSession(db, session);
  if (!retainer) return badRequest("Retainer profile not found");

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri =
    env.GOOGLE_OAUTH_REDIRECT_URL ??
    `${originFromRequest(request)}/api/google/oauth/callback`;
  const scopes = env.GOOGLE_OAUTH_SCOPES;
  if (!clientId || !redirectUri || !scopes) {
    return serverError("Google OAuth is not configured");
  }

  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const secure = request.url.startsWith("https");
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": stateCookie(state, secure),
    },
  });
};
