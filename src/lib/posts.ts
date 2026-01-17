// src/lib/posts.ts
//
// Local-first Retainer posts (social feed items).
// Used by the Seeker "Feed" view once a Seeker is linked to a Retainer.

import { getRetainerEntitlements } from "./entitlements";
import { readStoreData, writeStore } from "./storage";

export type RetainerPostType = "AD" | "UPDATE";
export type RetainerPostAudience = "LINKED_ONLY" | "PUBLIC";
export type RetainerPostStatus = "ACTIVE" | "ARCHIVED";

export type RetainerPost = {
  id: string;
  retainerId: string;

  type: RetainerPostType;
  audience: RetainerPostAudience;
  status: RetainerPostStatus;

  title: string;
  body: string;

  createdAt: string;
  updatedAt: string;
};

const KEY = "snapdriver_retainer_posts_v1";
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

function normalize(raw: any): RetainerPost | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.retainerId) return null;

  const type: RetainerPostType =
    raw.type === "AD" || raw.type === "UPDATE" ? raw.type : "UPDATE";
  const audience: RetainerPostAudience = raw.audience === "PUBLIC" ? "PUBLIC" : "LINKED_ONLY";
  const status: RetainerPostStatus = raw.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE";

  return {
    id: String(raw.id || makeId("post")),
    retainerId: String(raw.retainerId),
    type,
    audience,
    status,
    title: String(raw.title ?? ""),
    body: String(raw.body ?? ""),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function loadAll(): RetainerPost[] {
  const parsed = readStoreData<unknown>(KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[]).map(normalize).filter((x): x is RetainerPost => x !== null);
}

function saveAll(list: RetainerPost[]) {
  writeStore(KEY, SCHEMA_VERSION, list);
}

export function getAllRetainerPosts(): RetainerPost[] {
  return loadAll().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getRetainerPosts(retainerId: string): RetainerPost[] {
  if (!retainerId) return [];
  return getAllRetainerPosts().filter((p) => p.retainerId === retainerId);
}

function countPublicPostsThisMonth(retainerId: string): number {
  if (!retainerId) return 0;
  const mk = monthKey(new Date());
  return getRetainerPosts(retainerId).filter((p) => {
    if (p.status !== "ACTIVE") return false;
    if (p.audience !== "PUBLIC") return false;
    const d = new Date(p.createdAt);
    if (Number.isNaN(d.getTime())) return false;
    return monthKey(d) === mk;
  }).length;
}

function assertCreateAllowed(retainerId: string, audience: RetainerPostAudience) {
  const ent = getRetainerEntitlements(retainerId);
  if (audience === "PUBLIC") {
    if (!ent.canPostPublic) throw new Error("Public posting requires a higher tier.");
    const used = countPublicPostsThisMonth(retainerId);
    if (Number.isFinite(ent.maxPublicPostsPerMonth) && used >= ent.maxPublicPostsPerMonth) {
      throw new Error("Monthly public post limit reached for this tier.");
    }
  }
}

export function createRetainerPost(input: {
  retainerId: string;
  type: RetainerPostType;
  audience: RetainerPostAudience;
  title: string;
  body: string;
}): RetainerPost {
  const retainerId = String(input.retainerId || "").trim();
  if (!retainerId) throw new Error("retainerId is required");
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();
  if (!title) throw new Error("title is required");
  if (!body) throw new Error("body is required");

  const type: RetainerPostType = input.type === "AD" ? "AD" : "UPDATE";
  const audience: RetainerPostAudience = input.audience === "PUBLIC" ? "PUBLIC" : "LINKED_ONLY";

  assertCreateAllowed(retainerId, audience);

  const ts = nowIso();
  const post: RetainerPost = {
    id: makeId("post"),
    retainerId,
    type,
    audience,
    status: "ACTIVE",
    title,
    body,
    createdAt: ts,
    updatedAt: ts,
  };

  const all = loadAll();
  all.push(post);
  saveAll(all);
  return post;
}

export function updateRetainerPost(
  postId: string,
  patch: Partial<
    Pick<
      RetainerPost,
      "type" | "audience" | "status" | "title" | "body"
    >
  >
): RetainerPost | null {
  if (!postId) return null;
  const all = loadAll();
  const idx = all.findIndex((p) => p.id === postId);
  if (idx < 0) return null;

  const current = all[idx];
  const nextAudience: RetainerPostAudience =
    patch.audience === "PUBLIC"
      ? "PUBLIC"
      : patch.audience === "LINKED_ONLY"
        ? "LINKED_ONLY"
        : current.audience;

  // If promoting to PUBLIC, ensure the tier supports it and quota remains.
  if (current.audience !== "PUBLIC" && nextAudience === "PUBLIC") {
    assertCreateAllowed(current.retainerId, "PUBLIC");
  }

  const nextType: RetainerPostType =
    patch.type === "AD" || patch.type === "UPDATE" ? patch.type : current.type;
  const nextStatus: RetainerPostStatus =
    patch.status === "ARCHIVED" || patch.status === "ACTIVE"
      ? patch.status
      : current.status;

  const next: RetainerPost = {
    ...current,
    type: nextType,
    audience: nextAudience,
    status: nextStatus,
    title: typeof patch.title === "string" ? patch.title : current.title,
    body: typeof patch.body === "string" ? patch.body : current.body,
    updatedAt: nowIso(),
  };

  all[idx] = next;
  saveAll(all);
  return next;
}

