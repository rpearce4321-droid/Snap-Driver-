import { badRequest, json, requireDb, serverError } from "../_db";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  getAccessToken,
  updateCalendarEvent,
} from "../google/_calendar";

type Payload = {
  seekers?: any[];
  retainers?: any[];
  retainerUsers?: any[];
  subcontractors?: any[];
  links?: any[];
  conversations?: any[];
  messages?: any[];
  routes?: any[];
  routeInterests?: any[];
  posts?: any[];
  broadcasts?: any[];
  meetings?: any[];
  badgeDefinitions?: any[];
  badgeSelections?: any[];
  badgeCheckins?: any[];
  reputationScores?: any[];
  recordHallEntries?: any[];
  systemSettings?: Array<{ key: string; value: string }>;

};

function isSeedItem(item: any) {
  return Boolean(item?.isSeed || item?.__seed);
}

function seedBatchIdFor(item: any) {
  if (typeof item?.seedBatchId === "string") return item.seedBatchId;
  return null;
}

function meetingStatus(raw: any) {
  const value = String(raw || "DRAFT").toUpperCase();
  return value === "FINALIZED" || value === "CANCELED" || value === "PROPOSED"
    ? value
    : "DRAFT";
}

function meetingTitle(item: any) {
  const title = typeof item?.title === "string" ? item.title.trim() : "";
  return title || "SnapDriver Interview";
}

function meetingDescription(item: any) {
  const note = typeof item?.note === "string" ? item.note.trim() : "";
  const attendees = Array.isArray(item?.attendees) ? item.attendees : [];
  const names = attendees
    .map((a: any) => a?.seekerName)
    .filter((n: any) => typeof n === "string" && n.trim())
    .join(", ");
  const lines = [];
  if (note) lines.push(note);
  if (names) lines.push(`Attendees: ${names}`);
  return lines.join("\n");
}

function meetingAttendeeEmails(item: any): string[] {
  if (!Array.isArray(item?.attendees)) return [];
  return item.attendees
    .filter((a: any) => {
      if (!a) return false;
      const status = String(a.responseStatus || "INVITED").toUpperCase();
      return status !== "DECLINED";
    })
    .map((a: any) => a?.seekerEmail)
    .filter((email: any) => typeof email === "string" && email.includes("@"));
}

async function syncMeetingCalendar(env: any, db: any, item: any) {
  if (!item || !item.id || !item.retainerId) return;
  if (isSeedItem(item)) return;
  const status = meetingStatus(item.status);
  if (status !== "FINALIZED" && status !== "CANCELED") return;
  const accessToken = await getAccessToken(env, item.retainerId);
  if (!accessToken) return;

  const attendees = meetingAttendeeEmails(item);
  const title = meetingTitle(item);
  const description = meetingDescription(item);

  if (status === "FINALIZED") {
    if (!item.startsAt || !item.endsAt) return;
    try {
      if (item.googleEventId) {
        const updated = await updateCalendarEvent({
          accessToken,
          eventId: item.googleEventId,
          summary: title,
          description,
          startAt: item.startsAt,
          endAt: item.endsAt,
          timeZone: item.timezone || "America/New_York",
          attendees,
        });
        item.googleEventId = updated.eventId;
        item.meetLink = updated.meetLink ?? item.meetLink ?? null;
      } else {
        const created = await createCalendarEvent({
          accessToken,
          summary: title,
          description,
          startAt: item.startsAt,
          endAt: item.endsAt,
          timeZone: item.timezone || "America/New_York",
          attendees,
        });
        item.googleEventId = created.eventId;
        item.meetLink = created.meetLink ?? null;
      }
    } catch {
      return;
    }
  }

  if (status === "CANCELED" && item.googleEventId) {
    try {
      await deleteCalendarEvent({ accessToken, eventId: item.googleEventId });
    } catch {
      // ignore delete failures
    }
  }

  await db
    .prepare(
      "UPDATE interview_meetings SET status = ?, title = ?, data_json = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(
      status,
      item.title ?? null,
      JSON.stringify({ ...item, status }),
      item.id
    )
    .run();
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const db = requireDb(env as any);
  let payload: Payload = {};
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const runUpserts = async (rows: Array<{ stmt: string; values: any[] }>) => {
    for (const { stmt, values } of rows) {
      await db.prepare(stmt).bind(...values).run();
    }
  };

  try {
    const seekers = payload.seekers ?? [];
    if (seekers.length) {
      const rows = seekers.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO seekers (id, status, first_name, last_name, company_name, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
            id,
            (item.status || "PENDING").toUpperCase(),
            item.firstName ?? null,
            item.lastName ?? null,
            item.companyName ?? null,
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
            item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
          ],
        };
      });
      await runUpserts(rows);
    }

    const retainers = payload.retainers ?? [];
    if (retainers.length) {
      const rows = retainers.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO retainers (id, status, company_name, ceo_name, payment_terms, pay_cycle_close_day, pay_cycle_frequency, pay_cycle_timezone, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
            id,
            (item.status || "PENDING").toUpperCase(),
            item.companyName ?? "",
            item.ceoName ?? null,
            item.paymentTerms ?? null,
            item.payCycleCloseDay ?? null,
            item.payCycleFrequency ?? null,
            item.payCycleTimezone ?? null,
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
            item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
          ],
        };
      });
      await runUpserts(rows);
    }

    const retainerUsers = payload.retainerUsers ?? [];
    if (retainerUsers.length) {
      const rows = retainerUsers.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO retainer_users (id, retainer_id, first_name, last_name, title, email, phone, photo_url, bio, level, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
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
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const subcontractors = payload.subcontractors ?? [];
    if (subcontractors.length) {
      const rows = subcontractors.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO subcontractors (id, seeker_id, first_name, last_name, title, email, phone, photo_url, bio, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
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
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const links = payload.links ?? [];
    if (links.length) {
      const rows = links.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO links (id, retainer_id, seeker_id, status, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          values: [
            id,
            item.retainerId,
            item.seekerId,
            (item.status || "PENDING").toUpperCase(),
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const conversations = payload.conversations ?? [];
    if (conversations.length) {
      const rows = conversations.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO conversations (id, retainer_id, seeker_id, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          values: [
            id,
            item.retainerId,
            item.seekerId,
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const messages = payload.messages ?? [];
    if (messages.length) {
      const rows = messages.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO messages (id, conversation_id, sender_role, sender_id, body, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
            id,
            item.conversationId,
            (item.senderRole || "SEEKER").toUpperCase(),
            item.senderId ?? "",
            item.body ?? "",
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const routes = payload.routes ?? [];
    if (routes.length) {
      const rows = routes.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO routes (id, retainer_id, status, title, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          values: [
            id,
            item.retainerId,
            (item.status || "DRAFT").toUpperCase(),
            item.title ?? null,
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const routeInterests = payload.routeInterests ?? [];
    if (routeInterests.length) {
      const rows = routeInterests.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO route_interests (id, route_id, seeker_id, status, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
            id,
            item.routeId,
            item.seekerId,
            (item.status || "INTERESTED").toUpperCase(),
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const posts = payload.posts ?? [];
    if (posts.length) {
      const rows = posts.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO posts (id, retainer_id, type, status, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          values: [
            id,
            item.retainerId,
            (item.type || "POST").toUpperCase(),
            (item.status || "ACTIVE").toUpperCase(),
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const broadcasts = payload.broadcasts ?? [];
    if (broadcasts.length) {
      const rows = broadcasts.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO broadcasts (id, retainer_id, status, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          values: [
            id,
            item.retainerId,
            (item.status || "ACTIVE").toUpperCase(),
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const meetings = payload.meetings ?? [];
    if (meetings.length) {
      const rows = meetings.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO interview_meetings (id, retainer_id, status, title, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          values: [
            id,
            item.retainerId,
            (item.status || "DRAFT").toUpperCase(),
            item.title ?? null,
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const badgeDefinitions = payload.badgeDefinitions ?? [];
    if (badgeDefinitions.length) {
      const rows = badgeDefinitions.map((item) => {
        const id = item.id || crypto.randomUUID();
        const role = (item.role || item.ownerRole || "SEEKER").toUpperCase();
        return {
          stmt:
            "INSERT OR REPLACE INTO badge_definitions (id, role, title, icon_key, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          values: [
            id,
            role,
            item.title ?? "",
            item.iconKey ?? null,
            JSON.stringify({ ...item, id, ownerRole: role }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const badgeSelections = payload.badgeSelections ?? [];
    if (badgeSelections.length) {
      const rows = badgeSelections.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO badge_selections (id, owner_role, owner_id, badge_id, kind, is_active, locked_until, data_json, is_seed, seed_batch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          values: [
            id,
            (item.ownerRole || "SEEKER").toUpperCase(),
            item.ownerId,
            item.badgeId,
            (item.kind || "FOREGROUND").toUpperCase(),
            item.isActive === false ? 0 : 1,
            item.lockedUntil ?? null,
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const badgeCheckins = payload.badgeCheckins ?? [];
    if (badgeCheckins.length) {
      const rows = badgeCheckins.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO badge_checkins (id, badge_id, owner_role, owner_id, target_role, target_id, value, status, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
            id,
            item.badgeId,
            (item.ownerRole || item.targetRole || "SEEKER").toUpperCase(),
            item.ownerId ?? item.targetId,
            (item.targetRole || "SEEKER").toUpperCase(),
            item.targetId,
            (item.value || "YES").toUpperCase(),
            (item.status || "SUBMITTED").toUpperCase(),
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const reputationScores = payload.reputationScores ?? [];
    if (reputationScores.length) {
      const rows = reputationScores.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO reputation_scores (id, owner_role, owner_id, score, score_percent, note, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
            id,
            (item.ownerRole || "SEEKER").toUpperCase(),
            item.ownerId,
            Number(item.score ?? 0),
            Number(item.scorePercent ?? 0),
            item.note ?? null,
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const recordHallEntries = payload.recordHallEntries ?? [];
    if (recordHallEntries.length) {
      const rows = recordHallEntries.map((item) => {
        const id = item.id || crypto.randomUUID();
        return {
          stmt:
            "INSERT OR REPLACE INTO record_hall_entries (id, owner_role, owner_id, badge_id, value, delta, data_json, is_seed, seed_batch_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
          values: [
            id,
            (item.ownerRole || "SEEKER").toUpperCase(),
            item.ownerId,
            item.badgeId ?? null,
            item.value ?? null,
            item.delta ?? null,
            JSON.stringify({ ...item, id }),
            isSeedItem(item) ? 1 : 0,
            seedBatchIdFor(item),
          ],
        };
      });
      await runUpserts(rows);
    }

    const systemSettings = payload.systemSettings ?? [];
    if (systemSettings.length) {
      const rows = systemSettings.map((item) => ({
        stmt:
          "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        values: [item.key, item.value],
      }));
      await runUpserts(rows);
    }

    if (meetings.length) {
      for (const meeting of meetings) {
        await syncMeetingCalendar(env as any, db, { ...meeting });
      }
    }
  } catch (err: any) {
    return serverError(err?.message || "Failed to upsert server data");
  }

  return json({ ok: true });
};





