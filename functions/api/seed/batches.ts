import { json, requireDb } from "../_db";

export const onRequestGet: PagesFunction = async ({ env }) => {
  const db = requireDb(env as any);
  const rows = await db.prepare("SELECT id, label, created_at FROM seed_batches ORDER BY created_at DESC").all<any>();
  const items = rows.results.map((row: any) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
  }));
  return json({ items });
};
