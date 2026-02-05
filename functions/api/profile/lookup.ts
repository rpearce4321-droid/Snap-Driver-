import { badRequest, json, requireDb } from "../_db";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const role = url.searchParams.get("role")?.trim().toUpperCase();
  if (!email || !role) return badRequest("email and role are required");

  const pattern = `%${email}%`;
  if (role === "SEEKER") {
    const row = await db
      .prepare("SELECT id, status, data_json FROM seekers WHERE LOWER(data_json) LIKE ? ORDER BY created_at DESC LIMIT 1")
      .bind(pattern)
      .first<any>();
    if (!row) return badRequest("No seeker profile found for that email");
    return json({ ok: true, id: row.id, status: row.status });
  }
  if (role === "RETAINER") {
    const row = await db
      .prepare("SELECT id, status, data_json FROM retainers WHERE LOWER(data_json) LIKE ? ORDER BY created_at DESC LIMIT 1")
      .bind(pattern)
      .first<any>();
    if (!row) return badRequest("No retainer profile found for that email");
    return json({ ok: true, id: row.id, status: row.status });
  }

  return badRequest("Invalid role");
};
