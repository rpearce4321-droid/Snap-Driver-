export async function resolveRetainerForSession(
  db: any,
  session: { user_id?: string; email?: string } | null
) {
  if (!session?.user_id) return null;
  let retainer = await db
    .prepare("SELECT id FROM retainers WHERE user_id = ?")
    .bind(session.user_id)
    .first<any>();
  if (retainer) return retainer;

  const email = session.email?.trim().toLowerCase();
  if (!email) return null;

  retainer = await db
    .prepare(
      "SELECT id FROM retainers WHERE LOWER(data_json) LIKE ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(`%${email}%`)
    .first<any>();
  if (!retainer) return null;

  await db
    .prepare("UPDATE retainers SET user_id = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(session.user_id, retainer.id)
    .run();

  return retainer;
}
