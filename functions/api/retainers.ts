import { badRequest, json, requireDb } from "./_db";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const take = Math.min(Number(url.searchParams.get("take") || "50"), 200);
  const query = url.searchParams.get("query")?.trim().toLowerCase();

  const params: any[] = [];
  let where = "1=1";
  if (status) {
    where += " AND status = ?";
    params.push(status.toUpperCase());
  }
  if (query) {
    where += " AND (LOWER(company_name) LIKE ? OR LOWER(ceo_name) LIKE ?)";
    const q = `%${query}%`;
    params.push(q, q);
  }

  const stmt = db.prepare(
    `SELECT id, status, company_name, ceo_name, data_json, created_at FROM retainers WHERE ${where} ORDER BY created_at DESC LIMIT ?`
  );
  params.push(take);
  const rows = await stmt.bind(...params).all<any>();

  const items = rows.results.map((row: any) => {
    const extra = row.data_json ? JSON.parse(row.data_json) : {};
    return {
      id: row.id,
      role: "RETAINER",
      status: row.status,
      companyName: row.company_name ?? extra.companyName,
      ceoName: row.ceo_name ?? extra.ceoName,
      createdAt: row.created_at ? Date.parse(row.created_at) : extra.createdAt,
      ...extra,
    };
  });

  return json({ items, nextCursor: null });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const id = payload.id || crypto.randomUUID();
  const status = (payload.status || "PENDING").toUpperCase();
  const companyName = payload.companyName ?? "";
  const ceoName = payload.ceoName ?? null;
  const createdAt = payload.createdAt ? new Date(payload.createdAt).toISOString() : new Date().toISOString();

  await db
    .prepare(
      "INSERT INTO retainers (id, status, company_name, ceo_name, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    )
    .bind(id, status, companyName, ceoName, JSON.stringify(payload), createdAt)
    .run();

  return json({ ok: true, id });
};
