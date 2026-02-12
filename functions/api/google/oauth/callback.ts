import { getCookie, loadSession, originFromRequest } from "../../_auth";
import { badRequest, json, requireDb } from "../../_db";

const STATE_COOKIE = "sd_google_oauth_state";

function clearStateCookie(secure: boolean) {
  const parts = [
    `${STATE_COOKIE}=`,
    "Path=/",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

async function exchangeCode(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const body = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "OAuth exchange failed");
  }
  return res.json<any>();
}

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const secure = request.url.startsWith("https");
  const origin = originFromRequest(request);

  if (error) {
    return Response.redirect(`${origin}/retainers?oauth=error`, 302);
  }
  if (!code || !state) {
    return Response.redirect(`${origin}/retainers?oauth=error`, 302);
  }

  const stateCookie = getCookie(request, STATE_COOKIE);
  if (!stateCookie || stateCookie !== state) {
    return Response.redirect(`${origin}/retainers?oauth=state_mismatch`, 302);
  }

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
  if (!retainer) return badRequest("Retainer profile not found");

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    env.GOOGLE_OAUTH_REDIRECT_URL ??
    `${originFromRequest(request)}/api/google/oauth/callback`;
  if (!clientId || !clientSecret || !redirectUri) {
    return json({ ok: false, error: "Google OAuth not configured" }, { status: 500 });
  }

  const tokenData = await exchangeCode({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });

  const accessToken = String(tokenData.access_token ?? "");
  const refreshToken = String(tokenData.refresh_token ?? "");
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
    : null;
  const scope = tokenData.scope ?? null;

  if (!accessToken) {
    return json({ ok: false, error: "No access token returned" }, { status: 400 });
  }

  let finalRefresh = refreshToken;
  if (!finalRefresh) {
    const existing = await db
      .prepare("SELECT refresh_token FROM google_oauth_tokens WHERE retainer_id = ?")
      .bind(retainer.id)
      .first<any>();
    finalRefresh = existing?.refresh_token ?? "";
  }
  if (!finalRefresh) {
    return json({ ok: false, error: "No refresh token available" }, { status: 400 });
  }

  const id = `google_${retainer.id}`;
  await db
    .prepare(
      "INSERT OR REPLACE INTO google_oauth_tokens (id, retainer_id, access_token, refresh_token, scope, expires_at, revoked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, COALESCE((SELECT created_at FROM google_oauth_tokens WHERE retainer_id = ?), datetime('now')), datetime('now'))"
    )
    .bind(id, retainer.id, accessToken, finalRefresh, scope, expiresAt, retainer.id)
    .run();

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/retainers?oauth=connected`,
      "Set-Cookie": clearStateCookie(secure),
    },
  });
};
