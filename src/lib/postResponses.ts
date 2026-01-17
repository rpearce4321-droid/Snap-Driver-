// src/lib/postResponses.ts

import { readStoreData, writeStore } from "./storage";

export type PostResponseType =
  | "INTERESTED"
  | "REQUEST_INFO"
  | "NOT_INTERESTED"
  | "DIRECT_MESSAGE";

export type PostResponse = {
  id: string;
  postId: string;
  retainerId: string;
  seekerId: string;
  type: PostResponseType;
  reasonCode?: string;
  note?: string;
  createdAt: string;
};

const KEY = "snapdriver_post_responses_v1";
const SCHEMA_VERSION = 1;
export const POST_RESPONSES_EVENT = "snapdriver:post-responses";

function nowIso() {
  return new Date().toISOString();
}

function emitChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(POST_RESPONSES_EVENT));
  } catch {
    // ignore
  }
}

function makeId(prefix: string) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rnd}`;
}

function loadAll(): PostResponse[] {
  if (typeof window === "undefined") return [];
  const parsed = readStoreData<PostResponse[]>(KEY);
  return Array.isArray(parsed) ? parsed : [];
}

function saveAll(list: PostResponse[]) {
  if (typeof window === "undefined") return;
  writeStore(KEY, SCHEMA_VERSION, list);
}

export function recordPostResponse(args: {
  postId: string;
  retainerId: string;
  seekerId: string;
  type: PostResponseType;
  reasonCode?: string;
  note?: string;
}): PostResponse {
  const postId = String(args.postId || "").trim();
  const retainerId = String(args.retainerId || "").trim();
  const seekerId = String(args.seekerId || "").trim();
  if (!postId || !retainerId || !seekerId) {
    throw new Error("postId, retainerId, seekerId are required");
  }

  const all = loadAll();
  const next = all.filter(
    (r) => !(r.postId === postId && r.seekerId === seekerId)
  );

  const createdAt = nowIso();
  const response: PostResponse = {
    id: makeId("post_resp"),
    postId,
    retainerId,
    seekerId,
    type: args.type,
    reasonCode: args.reasonCode || undefined,
    note: args.note || undefined,
    createdAt,
  };

  next.unshift(response);
  saveAll(next);
  emitChange();
  return response;
}

export function getPostResponsesForPost(postId: string): PostResponse[] {
  const pid = String(postId || "").trim();
  if (!pid) return [];
  return loadAll()
    .filter((r) => r.postId === pid)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getPostResponseCounts(postId: string): Record<PostResponseType, number> {
  const counts: Record<PostResponseType, number> = {
    INTERESTED: 0,
    REQUEST_INFO: 0,
    NOT_INTERESTED: 0,
    DIRECT_MESSAGE: 0,
  };
  for (const r of getPostResponsesForPost(postId)) {
    counts[r.type] += 1;
  }
  return counts;
}

export function getPostResponsesGrouped(postId: string): Record<PostResponseType, PostResponse[]> {
  const grouped: Record<PostResponseType, PostResponse[]> = {
    INTERESTED: [],
    REQUEST_INFO: [],
    NOT_INTERESTED: [],
    DIRECT_MESSAGE: [],
  };
  for (const r of getPostResponsesForPost(postId)) {
    grouped[r.type].push(r);
  }
  return grouped;
}

export function getPostResponseForSeeker(postId: string, seekerId: string): PostResponse | null {
  const pid = String(postId || "").trim();
  const sid = String(seekerId || "").trim();
  if (!pid || !sid) return null;
  return loadAll().find((r) => r.postId === pid && r.seekerId === sid) || null;
}
