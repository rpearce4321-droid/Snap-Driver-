// src/lib/feedReactions.ts

import { readStoreData, writeStore } from "./storage";

export type FeedReactionItemKind = "BROADCAST" | "POST";
export type FeedReactionType = "LIKE" | "DISLIKE" | "QUESTION" | "ACKNOWLEDGE";

export const FEED_REACTION_OPTIONS: Array<{ type: FeedReactionType; label: string }> = [
  { type: "LIKE", label: "Thumbs up" },
  { type: "DISLIKE", label: "Thumbs down" },
  { type: "QUESTION", label: "Question" },
  { type: "ACKNOWLEDGE", label: "Acknowledged" },
];

export type FeedReaction = {
  id: string;
  itemKind: FeedReactionItemKind;
  itemId: string;
  retainerId: string;
  seekerId: string;
  type: FeedReactionType;
  createdAt: string;
};

const KEY = "snapdriver_feed_reactions_v1";
const SCHEMA_VERSION = 1;
export const FEED_REACTIONS_EVENT = "snapdriver:feed-reactions";

function nowIso() {
  return new Date().toISOString();
}

function emitChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(FEED_REACTIONS_EVENT));
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

function loadAll(): FeedReaction[] {
  if (typeof window === "undefined") return [];
  const parsed = readStoreData<FeedReaction[]>(KEY);
  return Array.isArray(parsed) ? parsed : [];
}

function saveAll(list: FeedReaction[]) {
  if (typeof window === "undefined") return;
  writeStore(KEY, SCHEMA_VERSION, list);
}

export function recordFeedReaction(args: {
  itemKind: FeedReactionItemKind;
  itemId: string;
  retainerId: string;
  seekerId: string;
  type: FeedReactionType;
}): FeedReaction {
  const itemKind = args.itemKind === "BROADCAST" ? "BROADCAST" : "POST";
  const itemId = String(args.itemId || "").trim();
  const retainerId = String(args.retainerId || "").trim();
  const seekerId = String(args.seekerId || "").trim();
  if (!itemId || !retainerId || !seekerId) {
    throw new Error("itemId, retainerId, seekerId are required");
  }

  const all = loadAll();
  const next = all.filter(
    (r) => !(r.itemKind === itemKind && r.itemId === itemId && r.seekerId === seekerId)
  );

  const reaction: FeedReaction = {
    id: makeId("feed_react"),
    itemKind,
    itemId,
    retainerId,
    seekerId,
    type: args.type,
    createdAt: nowIso(),
  };

  next.unshift(reaction);
  saveAll(next);
  emitChange();
  return reaction;
}

export function getFeedReactionsForItem(
  itemKind: FeedReactionItemKind,
  itemId: string
): FeedReaction[] {
  const kind = itemKind === "BROADCAST" ? "BROADCAST" : "POST";
  const id = String(itemId || "").trim();
  if (!id) return [];
  return loadAll()
    .filter((r) => r.itemKind === kind && r.itemId === id)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getFeedReactionCounts(
  itemKind: FeedReactionItemKind,
  itemId: string
): Record<FeedReactionType, number> {
  const counts: Record<FeedReactionType, number> = {
    LIKE: 0,
    DISLIKE: 0,
    QUESTION: 0,
    ACKNOWLEDGE: 0,
  };
  for (const r of getFeedReactionsForItem(itemKind, itemId)) {
    counts[r.type] += 1;
  }
  return counts;
}

export function getFeedReactionsGrouped(
  itemKind: FeedReactionItemKind,
  itemId: string
): Record<FeedReactionType, FeedReaction[]> {
  const grouped: Record<FeedReactionType, FeedReaction[]> = {
    LIKE: [],
    DISLIKE: [],
    QUESTION: [],
    ACKNOWLEDGE: [],
  };
  for (const r of getFeedReactionsForItem(itemKind, itemId)) {
    grouped[r.type].push(r);
  }
  return grouped;
}

export function getFeedReactionForSeeker(
  itemKind: FeedReactionItemKind,
  itemId: string,
  seekerId: string
): FeedReaction | null {
  const kind = itemKind === "BROADCAST" ? "BROADCAST" : "POST";
  const id = String(itemId || "").trim();
  const sid = String(seekerId || "").trim();
  if (!id || !sid) return null;
  return (
    loadAll().find((r) => r.itemKind === kind && r.itemId === id && r.seekerId === sid) ||
    null
  );
}
