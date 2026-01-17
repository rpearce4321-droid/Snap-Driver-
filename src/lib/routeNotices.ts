// src/lib/routeNotices.ts
//
// Route notice and bad-exit tracking for dedicated routes.

import { readStoreData, writeStore } from "./storage";

export type RouteNoticeStatus =
  | "ACTIVE"
  | "CONFIRMED_GOOD"
  | "CONFIRMED_BAD"
  | "DISPUTED"
  | "CANCELLED";

export type RouteNotice = {
  id: string;
  routeId: string;
  retainerId: string;
  seekerId: string;
  noticeGivenAt: string;
  effectiveEndAt: string;
  status: RouteNoticeStatus;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: "RETAINER" | "SYSTEM";
  disputeNote?: string;
  badExitTier?: number;
  penaltyPercent?: number;
  penaltyEndsAt?: string;
  flagEndsAt?: string;
  suspensionUntil?: string;
  blacklistAt?: string;
};

export type ActiveNoticeSummary = {
  count: number;
  daysLeft: number | null;
};

export type BadExitSummary = {
  count: number;
  daysLeft: number | null;
  penaltyPercent: number;
};

type BadExitTier = {
  tier: number;
  penaltyPercent: number;
  durationDays: number;
};

const KEY = "snapdriver_route_notices_v1";
const SCHEMA_VERSION = 1;

export const ROUTE_NOTICE_EVENT = "snapdriver:route-notices";

const BAD_EXIT_TIERS: BadExitTier[] = [
  { tier: 1, penaltyPercent: 15, durationDays: 30 },
  { tier: 2, penaltyPercent: 25, durationDays: 60 },
  { tier: 3, penaltyPercent: 35, durationDays: 90 },
];

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rnd}`;
}

function emitChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ROUTE_NOTICE_EVENT));
  } catch {
    // ignore
  }
}

function addDays(iso: string, days: number): string {
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString();
}

export function daysUntil(iso: string): number {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return 0;
  const diff = ts - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function normalize(raw: any): RouteNotice | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id || !raw.routeId || !raw.retainerId || !raw.seekerId) return null;

  const status: RouteNoticeStatus =
    raw.status === "CONFIRMED_GOOD" ||
    raw.status === "CONFIRMED_BAD" ||
    raw.status === "DISPUTED" ||
    raw.status === "CANCELLED"
      ? raw.status
      : "ACTIVE";

  const noticeGivenAt = typeof raw.noticeGivenAt === "string" ? raw.noticeGivenAt : nowIso();
  const effectiveEndAt = typeof raw.effectiveEndAt === "string" ? raw.effectiveEndAt : noticeGivenAt;
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : noticeGivenAt;

  return {
    id: String(raw.id),
    routeId: String(raw.routeId),
    retainerId: String(raw.retainerId),
    seekerId: String(raw.seekerId),
    noticeGivenAt,
    effectiveEndAt,
    status,
    updatedAt,
    resolvedAt: typeof raw.resolvedAt === "string" ? raw.resolvedAt : undefined,
    resolvedBy: raw.resolvedBy === "RETAINER" || raw.resolvedBy === "SYSTEM" ? raw.resolvedBy : undefined,
    disputeNote: typeof raw.disputeNote === "string" ? raw.disputeNote : undefined,
    badExitTier: Number.isFinite(raw.badExitTier) ? Number(raw.badExitTier) : undefined,
    penaltyPercent: Number.isFinite(raw.penaltyPercent) ? Number(raw.penaltyPercent) : undefined,
    penaltyEndsAt: typeof raw.penaltyEndsAt === "string" ? raw.penaltyEndsAt : undefined,
    flagEndsAt: typeof raw.flagEndsAt === "string" ? raw.flagEndsAt : undefined,
    suspensionUntil: typeof raw.suspensionUntil === "string" ? raw.suspensionUntil : undefined,
    blacklistAt: typeof raw.blacklistAt === "string" ? raw.blacklistAt : undefined,
  };
}

function loadAll(): RouteNotice[] {
  const parsed = readStoreData<unknown>(KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[]).map(normalize).filter((x): x is RouteNotice => x !== null);
}

function saveAll(list: RouteNotice[]) {
  writeStore(KEY, SCHEMA_VERSION, list);
}

export function getAllRouteNotices(): RouteNotice[] {
  return loadAll().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getRouteNoticesForSeeker(seekerId: string): RouteNotice[] {
  if (!seekerId) return [];
  return getAllRouteNotices().filter((n) => n.seekerId === seekerId);
}

export function getRouteNoticesForRetainer(retainerId: string): RouteNotice[] {
  if (!retainerId) return [];
  return getAllRouteNotices().filter((n) => n.retainerId === retainerId);
}

export function getActiveRouteNoticesForSeeker(seekerId: string): RouteNotice[] {
  return getRouteNoticesForSeeker(seekerId).filter((n) => n.status === "ACTIVE");
}

export function getActiveRouteNoticesForRetainer(retainerId: string): RouteNotice[] {
  return getRouteNoticesForRetainer(retainerId).filter((n) => n.status === "ACTIVE");
}

function isBadExitActive(n: RouteNotice): boolean {
  const end = n.flagEndsAt ?? n.penaltyEndsAt;
  if (!end) return false;
  const ts = Date.parse(end);
  return Number.isFinite(ts) && ts > Date.now();
}

function activeBadExitsForSeeker(seekerId: string): RouteNotice[] {
  return getRouteNoticesForSeeker(seekerId).filter(
    (n) => n.status === "CONFIRMED_BAD" && isBadExitActive(n)
  );
}

export function getActiveNoticeSummaryForSeeker(seekerId: string): ActiveNoticeSummary {
  const active = getActiveRouteNoticesForSeeker(seekerId);
  if (active.length === 0) return { count: 0, daysLeft: null };
  const soonest = Math.min(
    ...active.map((n) => {
      const ts = Date.parse(n.effectiveEndAt);
      return Number.isFinite(ts) ? ts : Date.now();
    })
  );
  const daysLeft = daysUntil(new Date(soonest).toISOString());
  return { count: active.length, daysLeft };
}

export function getActiveBadExitSummaryForSeeker(seekerId: string): BadExitSummary {
  const active = activeBadExitsForSeeker(seekerId);
  if (active.length === 0) return { count: 0, daysLeft: null, penaltyPercent: 0 };
  const maxEnd = Math.max(
    ...active.map((n) => {
      const ts = Date.parse(n.flagEndsAt ?? n.penaltyEndsAt ?? "");
      return Number.isFinite(ts) ? ts : Date.now();
    })
  );
  const penaltyPercent = active.reduce((sum, n) => sum + (n.penaltyPercent ?? 0), 0);
  return {
    count: active.length,
    daysLeft: daysUntil(new Date(maxEnd).toISOString()),
    penaltyPercent: Math.min(100, penaltyPercent),
  };
}

export function getActiveBadExitPenaltyPercent(seekerId: string): number {
  return getActiveBadExitSummaryForSeeker(seekerId).penaltyPercent;
}

export function getNextBadExitTierForSeeker(seekerId: string): BadExitTier {
  const activeCount = activeBadExitsForSeeker(seekerId).length;
  const tier = Math.min(3, activeCount + 1);
  return BAD_EXIT_TIERS[tier - 1];
}

export function createRouteNotice(args: {
  routeId: string;
  retainerId: string;
  seekerId: string;
  effectiveEndAt: string;
}): RouteNotice {
  const routeId = String(args.routeId || "").trim();
  const retainerId = String(args.retainerId || "").trim();
  const seekerId = String(args.seekerId || "").trim();
  if (!routeId || !retainerId || !seekerId) {
    throw new Error("routeId, retainerId, seekerId are required");
  }

  const all = loadAll();
  const existingIdx = all.findIndex(
    (n) => n.routeId === routeId && n.seekerId === seekerId && n.status === "ACTIVE"
  );

  const ts = nowIso();
  const effectiveEndAt = typeof args.effectiveEndAt === "string" ? args.effectiveEndAt : ts;

  if (existingIdx >= 0) {
    const existing = all[existingIdx];
    const updated = {
      ...existing,
      effectiveEndAt,
      updatedAt: ts,
    };
    all[existingIdx] = updated;
    saveAll(all);
    emitChange();
    return updated;
  }

  const notice: RouteNotice = {
    id: makeId("route_notice"),
    routeId,
    retainerId,
    seekerId,
    noticeGivenAt: ts,
    effectiveEndAt,
    status: "ACTIVE",
    updatedAt: ts,
  };

  all.unshift(notice);
  saveAll(all);
  emitChange();
  return notice;
}

export function cancelRouteNotice(noticeId: string): RouteNotice | null {
  if (!noticeId) return null;
  const all = loadAll();
  const idx = all.findIndex((n) => n.id === noticeId);
  if (idx < 0) return null;
  const existing = all[idx];
  const ts = nowIso();
  const updated: RouteNotice = {
    ...existing,
    status: "CANCELLED",
    updatedAt: ts,
    resolvedAt: ts,
    resolvedBy: "SYSTEM",
  };
  all[idx] = updated;
  saveAll(all);
  emitChange();
  return updated;
}

export function confirmRouteNotice(args: {
  noticeId: string;
  outcome: "GOOD" | "BAD" | "DISPUTE";
  disputeNote?: string;
}): RouteNotice | null {
  if (!args.noticeId) return null;
  const all = loadAll();
  const idx = all.findIndex((n) => n.id === args.noticeId);
  if (idx < 0) return null;

  const existing = all[idx];
  const ts = nowIso();
  let updated: RouteNotice = {
    ...existing,
    updatedAt: ts,
  };

  if (args.outcome === "GOOD") {
    updated = {
      ...updated,
      status: "CONFIRMED_GOOD",
      resolvedAt: ts,
      resolvedBy: "RETAINER",
    };
  }

  if (args.outcome === "DISPUTE") {
    updated = {
      ...updated,
      status: "DISPUTED",
      disputeNote: args.disputeNote?.trim() || undefined,
    };
  }

  if (args.outcome === "BAD") {
    const tierInfo = getNextBadExitTierForSeeker(existing.seekerId);
    const penaltyEndsAt = addDays(ts, tierInfo.durationDays);
    const suspensionUntil = tierInfo.tier >= 3 ? addDays(ts, 45) : undefined;
    const blacklistAt = tierInfo.tier >= 3 ? suspensionUntil : undefined;
    updated = {
      ...updated,
      status: "CONFIRMED_BAD",
      resolvedAt: ts,
      resolvedBy: "RETAINER",
      badExitTier: tierInfo.tier,
      penaltyPercent: tierInfo.penaltyPercent,
      penaltyEndsAt,
      flagEndsAt: penaltyEndsAt,
      suspensionUntil,
      blacklistAt,
    };
  }

  all[idx] = updated;
  saveAll(all);
  emitChange();
  return updated;
}

export function getSeekerExitStatus(seekerId: string): {
  suspensionUntil: string | null;
  blacklistAt: string | null;
  isSuspended: boolean;
  isBlacklisted: boolean;
} {
  const notices = getRouteNoticesForSeeker(seekerId);
  const suspensionUntil = notices
    .map((n) => n.suspensionUntil)
    .filter((x): x is string => typeof x === "string")
    .sort()
    .slice(-1)[0] ?? null;
  const blacklistAt = notices
    .map((n) => n.blacklistAt)
    .filter((x): x is string => typeof x === "string")
    .sort()
    .slice(-1)[0] ?? null;

  const now = Date.now();
  const isSuspended = suspensionUntil ? Date.parse(suspensionUntil) > now : false;
  const isBlacklisted = blacklistAt ? Date.parse(blacklistAt) <= now : false;

  return { suspensionUntil, blacklistAt, isSuspended, isBlacklisted };
}
