const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_BASE =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type TokenRow = {
  id: string;
  retainer_id: string;
  access_token: string;
  refresh_token: string;
  scope?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
};

function getEnvValue(env: any, key: string): string {
  const value = env?.[key];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now() + 60_000;
}

function meetLinkFromEvent(event: any): string | null {
  if (event?.hangoutLink) return String(event.hangoutLink);
  const entry = Array.isArray(event?.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints.find((e: any) => e?.uri)
    : null;
  return entry?.uri ? String(entry.uri) : null;
}

async function loadToken(env: any, retainerId: string): Promise<TokenRow | null> {
  const row = await env.DB
    .prepare(
      "SELECT id, retainer_id, access_token, refresh_token, scope, expires_at, revoked_at FROM google_oauth_tokens WHERE retainer_id = ?"
    )
    .bind(retainerId)
    .first<TokenRow>();
  if (!row || row.revoked_at) return null;
  return row;
}

async function updateToken(env: any, retainerId: string, update: Partial<TokenRow>) {
  const accessToken = update.access_token;
  const refreshToken = update.refresh_token;
  const scope = update.scope ?? null;
  const expiresAt = update.expires_at ?? null;
  if (!accessToken || !refreshToken) return;
  const id = `google_${retainerId}`;
  await env.DB
    .prepare(
      "INSERT OR REPLACE INTO google_oauth_tokens (id, retainer_id, access_token, refresh_token, scope, expires_at, revoked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, COALESCE((SELECT created_at FROM google_oauth_tokens WHERE retainer_id = ?), datetime('now')), datetime('now'))"
    )
    .bind(id, retainerId, accessToken, refreshToken, scope, expiresAt, retainerId)
    .run();
}

async function refreshAccessToken(env: any, row: TokenRow): Promise<TokenRow | null> {
  const clientId = getEnvValue(env, "GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getEnvValue(env, "GOOGLE_OAUTH_CLIENT_SECRET");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const json = await res.json<any>();
  const expiresAt = json.expires_in
    ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
    : row.expires_at ?? null;
  const next: TokenRow = {
    ...row,
    access_token: String(json.access_token ?? row.access_token),
    scope: json.scope ?? row.scope,
    expires_at: expiresAt,
  };
  await updateToken(env, row.retainer_id, {
    access_token: next.access_token,
    refresh_token: row.refresh_token,
    scope: next.scope ?? null,
    expires_at: next.expires_at ?? null,
  });
  return next;
}

export async function getAccessToken(
  env: any,
  retainerId: string
): Promise<string | null> {
  const row = await loadToken(env, retainerId);
  if (!row) return null;
  if (!isExpired(row.expires_at)) return row.access_token;
  const refreshed = await refreshAccessToken(env, row);
  return refreshed?.access_token ?? null;
}

export async function createCalendarEvent(args: {
  accessToken: string;
  summary: string;
  description?: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  attendees: string[];
}): Promise<{ eventId: string; meetLink: string | null }> {
  const attendees = Array.from(
    new Set(args.attendees.filter((email) => email && email.includes("@")))
  ).map((email) => ({ email }));
  if (attendees.length === 0) {
    throw new Error("No attendee emails available for calendar invite.");
  }
  const payload = {
    summary: args.summary,
    description: args.description ?? "",
    start: { dateTime: args.startAt, timeZone: args.timeZone },
    end: { dateTime: args.endAt, timeZone: args.timeZone },
    attendees,
    conferenceData: {
      createRequest: { requestId: crypto.randomUUID() },
    },
  };
  const res = await fetch(`${EVENTS_BASE}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google event creation failed: ${text}`);
  }
  const data = await res.json<any>();
  return { eventId: String(data.id), meetLink: meetLinkFromEvent(data) };
}

export async function updateCalendarEvent(args: {
  accessToken: string;
  eventId: string;
  summary: string;
  description?: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  attendees: string[];
}): Promise<{ eventId: string; meetLink: string | null }> {
  const attendees = Array.from(
    new Set(args.attendees.filter((email) => email && email.includes("@")))
  ).map((email) => ({ email }));
  const payload = {
    summary: args.summary,
    description: args.description ?? "",
    start: { dateTime: args.startAt, timeZone: args.timeZone },
    end: { dateTime: args.endAt, timeZone: args.timeZone },
    attendees,
  };
  const res = await fetch(
    `${EVENTS_BASE}/${encodeURIComponent(args.eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google event update failed: ${text}`);
  }
  const data = await res.json<any>();
  return { eventId: String(data.id), meetLink: meetLinkFromEvent(data) };
}

export async function deleteCalendarEvent(args: {
  accessToken: string;
  eventId: string;
}): Promise<void> {
  await fetch(`${EVENTS_BASE}/${encodeURIComponent(args.eventId)}?sendUpdates=all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
}
