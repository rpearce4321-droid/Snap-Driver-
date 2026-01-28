import { badRequest, json, requireDb, serverError } from "../_db";

type LoadRequest = {
  label?: string;
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  let payload: LoadRequest = {};
  try {
    if (request.body) {
      payload = (await request.json()) as LoadRequest;
    }
  } catch {
    return badRequest("Invalid JSON body");
  }

  const id = crypto.randomUUID();
  const label = payload.label?.trim() || `seed_${new Date().toISOString().slice(0, 10)}`;

  try {
    await db
      .prepare("INSERT INTO seed_batches (id, label) VALUES (?, ?)")
      .bind(id, label)
      .run();
  } catch (err: any) {
    return serverError(err?.message || "Failed to create seed batch");
  }

  return json({ ok: true, seedBatchId: id, label });
};
