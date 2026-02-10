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
import { getRetainerById, getRetainers, getSeekerById, getSeekers } from "./data";
import { getConversationsForRetainer, getConversationsForSeeker } from "./messages";
import { getAssignmentsForRetainer } from "./workUnits";

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
    }
  | {
      kind: "MESSAGE";
      id: string;
      conversationId: string;
      seekerId: string;
      retainerId: string;
      createdAt: string;
      updatedAt: string;
      subject: string;
      preview: string;
      unreadCount: number;
    }
  | {
      kind: "PROFILE_APPROVED";
      id: string;
      profileRole: "SEEKER" | "RETAINER";
      profileId: string;
      createdAt: string;
      name: string;
      city?: string;
      state?: string;
      zip?: string;
    };

const PROFILE_FEED_WINDOW_DAYS = 30;

function normalizePlace(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

function isSameArea(
  a?: { city?: string; state?: string; zip?: string } | null,
  b?: { city?: string; state?: string; zip?: string } | null
): boolean {
  if (!a || !b) return true;
  const aZip = normalizePlace(a.zip);
  const bZip = normalizePlace(b.zip);
  if (aZip && bZip && aZip !== bZip) return false;

  const aState = normalizePlace(a.state);
  const bState = normalizePlace(b.state);
  if (aState && bState && aState !== bState) return false;

  const aCity = normalizePlace(a.city);
  const bCity = normalizePlace(b.city);
  if (aCity && bCity && aCity !== bCity) return false;

  return true;
}

function hasActiveAssignment(seekerId: string, retainerId: string): boolean {
  if (!seekerId || !retainerId) return false;
  return getAssignmentsForRetainer(retainerId).some(
    (a) => a.seekerId === seekerId && a.status === "ACTIVE"
  );
}

function isActiveWorkingLink(seekerId: string, retainerId: string): boolean {
  if (!seekerId || !retainerId) return false;
  return (
    getLinksForSeeker(seekerId).some(
      (l) => l.retainerId === retainerId && l.status === "ACTIVE"
    ) && hasActiveAssignment(seekerId, retainerId)
  );
}

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
  const seeker = sid ? getSeekerById(sid) ?? null : null;

  const posts: FeedItem[] = getAllRetainerPosts()
    .filter((p) => p.status === "ACTIVE")
    .filter((p) => {
      if (p.audience === "PUBLIC") {
        if (!seeker) return true;
        const retainer = getRetainerById(p.retainerId);
        return isSameArea(seeker, retainer ?? null);
      }
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
      if (!sid) return false;
      return isActiveWorkingLink(sid, b.retainerId);
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

  const messages: FeedItem[] = sid
    ? getConversationsForSeeker(sid).map((c: any) => ({
        kind: "MESSAGE" as const,
        id: c.id,
        conversationId: c.id,
        seekerId: c.seekerId,
        retainerId: c.retainerId,
        createdAt: c.createdAt,
        updatedAt: c.lastMessageAt ?? c.updatedAt ?? c.createdAt,
        subject: c.subject || "Message",
        preview: c.lastMessagePreview || "",
        unreadCount: c.seekerUnreadCount ?? 0,
      }))
    : [];

  const approvals: FeedItem[] = seeker
    ? getRetainers()
        .filter((r) => r.status === "APPROVED")
        .filter((r) => isSameArea(seeker, r))
        .filter((r) => {
          const ts = r.approvedAt ?? r.createdAt ?? Date.now();
          return Date.now() - ts <= PROFILE_FEED_WINDOW_DAYS * 86_400_000;
        })
        .map((r) => ({
          kind: "PROFILE_APPROVED" as const,
          id: r.id,
          profileRole: "RETAINER" as const,
          profileId: r.id,
          createdAt: new Date(r.approvedAt ?? r.createdAt ?? Date.now()).toISOString(),
          name: r.companyName || "Retainer",
          city: r.city,
          state: r.state,
          zip: r.zip,
        }))
    : [];

  const merged = [...posts, ...broadcasts, ...routes, ...messages, ...approvals];
  merged.sort((a, b) => {
    const ta =
      a.kind === "POST" || a.kind === "ROUTE" || a.kind === "MESSAGE"
        ? Date.parse(a.updatedAt)
        : Date.parse(a.createdAt);
    const tb =
      b.kind === "POST" || b.kind === "ROUTE" || b.kind === "MESSAGE"
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

  const messages: FeedItem[] = getConversationsForRetainer(rid).map((c: any) => ({
    kind: "MESSAGE" as const,
    id: c.id,
    conversationId: c.id,
    seekerId: c.seekerId,
    retainerId: c.retainerId,
    createdAt: c.createdAt,
    updatedAt: c.lastMessageAt ?? c.updatedAt ?? c.createdAt,
    subject: c.subject || "Message",
    preview: c.lastMessagePreview || "",
    unreadCount: c.retainerUnreadCount ?? 0,
  }));

  const retainer = getRetainerById(rid);
  const approvals: FeedItem[] = retainer
    ? getSeekers()
        .filter((s) => s.status === "APPROVED")
        .filter((s) => isSameArea(retainer, s))
        .filter((s) => {
          const ts = s.approvedAt ?? s.createdAt ?? Date.now();
          return Date.now() - ts <= PROFILE_FEED_WINDOW_DAYS * 86_400_000;
        })
        .map((s) => ({
          kind: "PROFILE_APPROVED" as const,
          id: s.id,
          profileRole: "SEEKER" as const,
          profileId: s.id,
          createdAt: new Date(s.approvedAt ?? s.createdAt ?? Date.now()).toISOString(),
          name: [s.firstName, s.lastName].filter(Boolean).join(" ") || "Seeker",
          city: s.city,
          state: s.state,
          zip: s.zip,
        }))
    : [];

  const merged = [...posts, ...broadcasts, ...routes, ...messages, ...approvals];
  merged.sort((a, b) => {
    const ta =
      a.kind === "POST" || a.kind === "ROUTE" || a.kind === "MESSAGE"
        ? Date.parse(a.updatedAt)
        : Date.parse(a.createdAt);
    const tb =
      b.kind === "POST" || b.kind === "ROUTE" || b.kind === "MESSAGE"
        ? Date.parse(b.updatedAt)
        : Date.parse(b.createdAt);
    return tb - ta;
  });
  return merged;
}
