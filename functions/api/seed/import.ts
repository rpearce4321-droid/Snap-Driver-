import { badRequest, json, requireDb, serverError } from "../_db";

import { getCookie, loadSession } from "../_auth";
import { badRequest, json, requireDb, serverError } from "../_db";

type SeedPayload = {
  batchId?: string;
  label?: string;
  seekers?: any[];
  retainers?: any[];
  retainerUsers?: any[];
  subcontractors?: any[];
  links?: any[];
  conversations?: any[];
  messages?: any[];
  routes?: any[];
  routeInterests?: any[];
  routeAssignments?: any[];
  workUnitPeriods?: any[];
  posts?: any[];
  broadcasts?: any[];
  badgeDefinitions?: any[];
  badgeSelections?: any[];
  badgeCheckins?: any[];
  reputationScores?: any[];
  recordHallEntries?: any[];
};

async function requireAdmin(request: Request, env: any) {
  const token = getCookie(request, "sd_session");
  if (!token) return null;
  const session = await loadSession(env as any, token);
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  const admin = await requireAdmin(request, env as any);
  if (!admin) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let payload: SeedPayload = {};
  try {
    payload = (await request.json()) as SeedPayload;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const batchId = payload.batchId?.trim();
  if (!batchId) return badRequest("batchId is required");
  const label = payload.label?.trim();

  const inserts: Array<{ stmt: string; values: any[] }> = [];

  const push = (stmt: string, values: any[]) => inserts.push({ stmt, values });

  const nowIso = new Date().toISOString();

  try {
    await db
      .prepare("INSERT OR IGNORE INTO seed_batches (id, label) VALUES (?, ?)")
      .bind(batchId, label || `seed_${nowIso.slice(0, 10)}`)
      .run();
  } catch (err: any) {
    return serverError(err?.message || "Failed to record seed batch");
  }

  for (const item of payload.seekers ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO seekers (id, status, first_name, last_name, company_name, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))",
      [
        id,
        (item.status || "PENDING").toUpperCase(),
        item.firstName ?? null,
        item.lastName ?? null,
        item.companyName ?? null,
        JSON.stringify({ ...item, id }),
        batchId,
        item.createdAt ? new Date(item.createdAt).toISOString() : nowIso,
      ]
    );
  }

  for (const item of payload.retainers ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO retainers (id, status, company_name, ceo_name, payment_terms, pay_cycle_close_day, pay_cycle_frequency, pay_cycle_timezone, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))",
      [
        id,
        (item.status || "PENDING").toUpperCase(),
        item.companyName ?? "",
        item.ceoName ?? null,
        item.paymentTerms ?? null,
        item.payCycleCloseDay ?? null,
        item.payCycleFrequency ?? null,
        item.payCycleTimezone ?? null,
        JSON.stringify({ ...item, id }),
        batchId,
        item.createdAt ? new Date(item.createdAt).toISOString() : nowIso,
      ]
    );
  }

  for (const item of payload.retainerUsers ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO retainer_users (id, retainer_id, first_name, last_name, title, email, phone, photo_url, bio, level, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))",
      [
        id,
        item.retainerId,
        item.firstName ?? "",
        item.lastName ?? "",
        item.title ?? null,
        item.email ?? null,
        item.phone ?? null,
        item.photoUrl ?? null,
        item.bio ?? null,
        item.level ?? 1,
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.subcontractors ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO subcontractors (id, seeker_id, first_name, last_name, title, email, phone, photo_url, bio, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))",
      [
        id,
        item.seekerId,
        item.firstName ?? "",
        item.lastName ?? "",
        item.title ?? null,
        item.email ?? null,
        item.phone ?? null,
        item.photoUrl ?? null,
        item.bio ?? null,
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.links ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO links (id, retainer_id, seeker_id, status, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))",
      [
        id,
        item.retainerId,
        item.seekerId,
        (item.status || "PENDING").toUpperCase(),
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.conversations ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO conversations (id, retainer_id, seeker_id, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))",
      [id, item.retainerId, item.seekerId, JSON.stringify({ ...item, id }), batchId]
    );
  }

  for (const item of payload.messages ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO messages (id, conversation_id, sender_role, sender_id, body, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))",
      [
        id,
        item.conversationId,
        (item.senderRole || "SEEKER").toUpperCase(),
        item.senderId,
        item.body ?? "",
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.routes ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO routes (id, retainer_id, status, title, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))",
      [
        id,
        item.retainerId,
        (item.status || "DRAFT").toUpperCase(),
        item.title ?? null,
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.routeInterests ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO route_interests (id, route_id, seeker_id, status, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'))",
      [
        id,
        item.routeId,
        item.seekerId,
        (item.status || "INTERESTED").toUpperCase(),
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.routeAssignments ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO route_assignments (id, route_id, retainer_id, seeker_id, assignment_type, unit_type, cadence, expected_units_per_period, start_date, status, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))",
      [
        id,
        item.routeId,
        item.retainerId,
        item.seekerId,
        (item.assignmentType || "DEDICATED").toUpperCase(),
        (item.unitType || "DAY").toUpperCase(),
        (item.cadence || "WEEKLY").toUpperCase(),
        item.expectedUnitsPerPeriod ?? null,
        item.startDate ? new Date(item.startDate).toISOString() : nowIso,
        (item.status || "ACTIVE").toUpperCase(),
        JSON.stringify({ ...item, id }),
        batchId,
        item.createdAt ? new Date(item.createdAt).toISOString() : nowIso,
      ]
    );
  }

  for (const item of payload.workUnitPeriods ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO work_unit_periods (id, assignment_id, period_key, cadence, expected_units, accepted_units, completed_units, missed_units, status, seeker_response, admin_resolution, dispute_note, admin_note, retainer_submitted_at, seeker_responded_at, window_closes_at, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))",
      [
        id,
        item.assignmentId,
        item.periodKey,
        (item.cadence || "WEEKLY").toUpperCase(),
        item.expectedUnits ?? null,
        item.acceptedUnits ?? null,
        item.completedUnits ?? null,
        item.missedUnits ?? null,
        (item.status || "PENDING").toUpperCase(),
        (item.seekerResponse || "NONE").toUpperCase(),
        (item.adminResolution || "NONE").toUpperCase(),
        item.disputeNote ?? null,
        item.adminNote ?? null,
        item.retainerSubmittedAt ? new Date(item.retainerSubmittedAt).toISOString() : null,
        item.seekerRespondedAt ? new Date(item.seekerRespondedAt).toISOString() : null,
        item.windowClosesAt ? new Date(item.windowClosesAt).toISOString() : null,
        JSON.stringify({ ...item, id }),
        batchId,
        item.createdAt ? new Date(item.createdAt).toISOString() : nowIso,
      ]
    );
  }

  for (const item of payload.posts ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO posts (id, retainer_id, type, status, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))",
      [
        id,
        item.retainerId,
        (item.type || "POST").toUpperCase(),
        (item.status || "ACTIVE").toUpperCase(),
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.broadcasts ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO broadcasts (id, retainer_id, status, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))",
      [
        id,
        item.retainerId,
        (item.status || "ACTIVE").toUpperCase(),
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.badgeDefinitions ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT OR IGNORE INTO badge_definitions (id, role, title, icon_key, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))",
      [
        id,
        (item.role || "SEEKER").toUpperCase(),
        item.title ?? "",
        item.iconKey ?? null,
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.badgeSelections ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO badge_selections (id, owner_role, owner_id, badge_id, kind, is_active, locked_until, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))",
      [
        id,
        (item.ownerRole || "SEEKER").toUpperCase(),
        item.ownerId,
        item.badgeId,
        (item.kind || "FOREGROUND").toUpperCase(),
        item.isActive === false ? 0 : 1,
        item.lockedUntil ?? null,
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.badgeCheckins ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO badge_checkins (id, badge_id, owner_role, owner_id, target_role, target_id, value, status, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))",
      [
        id,
        item.badgeId,
        (item.ownerRole || "SEEKER").toUpperCase(),
        item.ownerId,
        (item.targetRole || "SEEKER").toUpperCase(),
        item.targetId,
        (item.value || "YES").toUpperCase(),
        (item.status || "SUBMITTED").toUpperCase(),
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.reputationScores ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO reputation_scores (id, owner_role, owner_id, score, score_percent, note, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))",
      [
        id,
        (item.ownerRole || "SEEKER").toUpperCase(),
        item.ownerId,
        item.score ?? 0,
        item.scorePercent ?? 0,
        item.note ?? null,
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  for (const item of payload.recordHallEntries ?? []) {
    const id = item.id || crypto.randomUUID();
    push(
      "INSERT INTO record_hall_entries (id, owner_role, owner_id, badge_id, value, delta, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))",
      [
        id,
        (item.ownerRole || "SEEKER").toUpperCase(),
        item.ownerId,
        item.badgeId ?? null,
        item.value ?? null,
        item.delta ?? null,
        JSON.stringify({ ...item, id }),
        batchId,
      ]
    );
  }

  try {
    for (const { stmt, values } of inserts) {
      await db.prepare(stmt).bind(...values).run();
    }
  } catch (err: any) {
    return serverError(err?.message || "Failed to import seed data");
  }

  return json({ ok: true, inserted: inserts.length });
};

