import { json, requireDb } from "../_db";

const statuses = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "DELETED"];

async function countByStatus(db: any, table: string) {
  const counts: Record<string, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
    deleted: 0,
  };
  for (const status of statuses) {
    const row = await db
      .prepare(`SELECT COUNT(*) as count FROM ${table} WHERE status = ?`)
      .bind(status)
      .first<any>();
    const key = status.toLowerCase();
    counts[key] = Number(row?.count ?? 0);
  }
  return counts;
}

export const onRequestGet: PagesFunction = async ({ env }) => {
  const db = requireDb(env as any);
  const seekers = await countByStatus(db, "seekers");
  const retainers = await countByStatus(db, "retainers");
  return json({ seekers, retainers });
};
