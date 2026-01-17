// src/lib/feed.ts
//
// Local-first Seeker feed aggregation.
// v1: combines Retainer posts + Retainer broadcasts, gated by ACTIVE links.

import type { RetainerPost } from "./posts";
import { getAllRetainerPosts, getRetainerPosts } from "./posts";
import type { RetainerBroadcast } from "./broadcasts";
import { getAllRetainerBroadcasts, getRetainerBroadcasts } from "./broadcasts";
import { getLinksForSeeker } from "./linking";
import type { Route } from "./routes";
import { getRoutesForRetainer, getVisibleRoutesForSeeker } from "./routes";

export type FeedItem =
  | {
      kind: "POST";
      id: string;
      retainerId: string;
      audience: RetainerPost["audience"];
      createdAt: string;
      updatedAt: string;
      post: RetainerPost;
    }
  | {
      kind: "BROADCAST";
      id: string;
      retainerId: string;
      audience: RetainerBroadcast["audience"];
      createdAt: string;
      broadcast: RetainerBroadcast;
    }
  | {
      kind: "ROUTE";
      id: string;
      retainerId: string;
      audience: Route["audience"];
      createdAt: string;
      updatedAt: string;
      route: Route;
    };

function isActiveLink(seekerId: string, retainerId: string): boolean {
  if (!seekerId || !retainerId) return false;
  return (
    getLinksForSeeker(seekerId).some(
      (l) => l.retainerId === retainerId && l.status === "ACTIVE"
    ) || false
  );
}

export function getFeedForSeeker(seekerId: string | null): FeedItem[] {
  const sid = String(seekerId || "").trim();

  const posts: FeedItem[] = getAllRetainerPosts()
    .filter((p) => p.status === "ACTIVE")
    .filter((p) => {
      if (p.audience === "PUBLIC") return true;
      if (!sid) return false;
      return isActiveLink(sid, p.retainerId);
    })
    .map((p) => ({
      kind: "POST" as const,
      id: p.id,
      retainerId: p.retainerId,
      audience: p.audience,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      post: p,
    }));

  const broadcasts: FeedItem[] = getAllRetainerBroadcasts()
    .filter((b) => b.status === "ACTIVE")
    .filter((b) => {
      if (b.audience === "PUBLIC") return true;
      if (!sid) return false;
      return isActiveLink(sid, b.retainerId);
    })
    .map((b) => ({
      kind: "BROADCAST" as const,
      id: b.id,
      retainerId: b.retainerId,
      audience: b.audience,
      createdAt: b.createdAt,
      broadcast: b,
    }));

  const routes: FeedItem[] = getVisibleRoutesForSeeker(sid)
    .filter((r) => r.status === "ACTIVE")
    .map((r) => ({
      kind: "ROUTE" as const,
      id: r.id,
      retainerId: r.retainerId,
      audience: r.audience,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      route: r,
    }));

  const merged = [...posts, ...broadcasts, ...routes];
  merged.sort((a, b) => {
    const ta =
      a.kind === "POST" || a.kind === "ROUTE"
        ? Date.parse(a.updatedAt)
        : Date.parse(a.createdAt);
    const tb =
      b.kind === "POST" || b.kind === "ROUTE"
        ? Date.parse(b.updatedAt)
        : Date.parse(b.createdAt);
    return tb - ta;
  });
  return merged;
}

export function getFeedForRetainer(retainerId: string | null): FeedItem[] {
  const rid = String(retainerId || "").trim();
  if (!rid) return [];

  const posts: FeedItem[] = getRetainerPosts(rid)
    .filter((p) => p.status === "ACTIVE")
    .map((p) => ({
      kind: "POST" as const,
      id: p.id,
      retainerId: p.retainerId,
      audience: p.audience,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      post: p,
    }));

  const broadcasts: FeedItem[] = getRetainerBroadcasts(rid)
    .filter((b) => b.status === "ACTIVE")
    .map((b) => ({
      kind: "BROADCAST" as const,
      id: b.id,
      retainerId: b.retainerId,
      audience: b.audience,
      createdAt: b.createdAt,
      broadcast: b,
    }));

  const routes: FeedItem[] = getRoutesForRetainer(rid)
    .filter((r) => r.status === "ACTIVE")
    .map((r) => ({
      kind: "ROUTE" as const,
      id: r.id,
      retainerId: r.retainerId,
      audience: r.audience,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      route: r,
    }));

  const merged = [...posts, ...broadcasts, ...routes];
  merged.sort((a, b) => {
    const ta =
      a.kind === "POST" || a.kind === "ROUTE"
        ? Date.parse(a.updatedAt)
        : Date.parse(a.createdAt);
    const tb =
      b.kind === "POST" || b.kind === "ROUTE"
        ? Date.parse(b.updatedAt)
        : Date.parse(b.createdAt);
    return tb - ta;
  });
  return merged;
}
