// src/lib/broadcasts.ts
//
// Local-first Retainer broadcasts.
// These are "mass updates" that show up in the Seeker feed (and later can power
// true mass DM delivery once we add linking-based distribution).

import { getRetainerEntitlements } from "./entitlements";
import { readStoreData, writeStore } from "./storage";

export type RetainerBroadcastAudience = "LINKED_ONLY" | "PUBLIC";
export type RetainerBroadcastStatus = "ACTIVE" | "ARCHIVED";

export type RetainerBroadcast = {
  id: string;
  retainerId: string;

  audience: RetainerBroadcastAudience;
  status: RetainerBroadcastStatus;

  subject: string;
  body: string;

  createdAt: string;
};

const KEY = "snapdriver_retainer_broadcasts_v1";
const SCHEMA_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function makeId(prefix: string) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rnd}`;
}

function normalize(raw: any): RetainerBroadcast | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.retainerId) return null;

  const audience: RetainerBroadcastAudience = "LINKED_ONLY";
  const status: RetainerBroadcastStatus = raw.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";

  return {
    id: String(raw.id || makeId("broadcast")),
    retainerId: String(raw.retainerId),
    audience,
    status,
    subject: String(raw.subject ?? ""),
    body: String(raw.body ?? ""),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
  };
}

function loadAll(): RetainerBroadcast[] {
  const parsed = readStoreData<unknown>(KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[]).map(normalize).filter((x): x is RetainerBroadcast => x !== null);
}

function saveAll(list: RetainerBroadcast[]) {
  writeStore(KEY, SCHEMA_VERSION, list);
}

export function getAllRetainerBroadcasts(): RetainerBroadcast[] {
  return loadAll().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getRetainerBroadcasts(retainerId: string): RetainerBroadcast[] {
  if (!retainerId) return [];
  return getAllRetainerBroadcasts().filter((b) => b.retainerId === retainerId);
}

function countBroadcastsThisMonth(retainerId: string): number {
  if (!retainerId) return 0;
  const mk = monthKey(new Date());
  return getRetainerBroadcasts(retainerId).filter((b) => {
    if (b.status !== "ACTIVE") return false;
    const d = new Date(b.createdAt);
    if (Number.isNaN(d.getTime())) return false;
    return monthKey(d) === mk;
  }).length;
}

function assertBroadcastAllowed(retainerId: string) {
  const ent = getRetainerEntitlements(retainerId);
  const used = countBroadcastsThisMonth(retainerId);
  if (Number.isFinite(ent.maxBroadcastsPerMonth) && used >= ent.maxBroadcastsPerMonth) {
    throw new Error("Monthly broadcast limit reached for this tier.");
  }
}

export function createRetainerBroadcast(input: {
  retainerId: string;
  audience: RetainerBroadcastAudience;
  subject: string;
  body: string;
}): RetainerBroadcast {
  const retainerId = String(input.retainerId || "").trim();
  if (!retainerId) throw new Error("retainerId is required");
  const subject = String(input.subject || "").trim();
  const body = String(input.body || "").trim();
  if (!subject) throw new Error("subject is required");
  if (!body) throw new Error("body is required");

  const audience: RetainerBroadcastAudience = "LINKED_ONLY";
  assertBroadcastAllowed(retainerId);

  const msg: RetainerBroadcast = {
    id: makeId("broadcast"),
    retainerId,
    audience,
    status: "ACTIVE",
    subject,
    body,
    createdAt: nowIso(),
  };

  const all = loadAll();
  all.push(msg);
  saveAll(all);
  return msg;
}

export function updateRetainerBroadcast(
  broadcastId: string,
  patch: Partial<Pick<RetainerBroadcast, "audience" | "status" | "subject" | "body">>
): RetainerBroadcast | null {
  if (!broadcastId) return null;
  const all = loadAll();
  const idx = all.findIndex((b) => b.id === broadcastId);
  if (idx < 0) return null;

  const current = all[idx];
  const nextAudience: RetainerBroadcastAudience = current.audience;

  const nextStatus: RetainerBroadcastStatus =
    patch.status === "ARCHIVED" || patch.status === "ACTIVE"
      ? patch.status
      : current.status;

  const next: RetainerBroadcast = {
    ...current,
    audience: nextAudience,
    status: nextStatus,
    subject: typeof patch.subject === "string" ? patch.subject : current.subject,
    body: typeof patch.body === "string" ? patch.body : current.body,
  };

  all[idx] = next;
  saveAll(all);
  return next;
}
