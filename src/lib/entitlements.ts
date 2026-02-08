// src/lib/entitlements.ts
//
// Local-first entitlements ("hybrid monetization"): seats + reach + throughput.
// This is intentionally minimal and additive so we can iterate without breaking portals.

import { readStoreData, writeStore } from "./storage";

export type PlanScope = "RETAINER" | "SEEKER";

export type RetainerTier = "STARTER" | "GROWTH" | "ENTERPRISE";
export type SeekerTier = "TRIAL" | "STARTER" | "GROWTH" | "ELITE";

export type RetainerEntitlements = {
  scope: "RETAINER";
  tier: RetainerTier;

  // Seats
  maxUsers: number;

  // Reach
  canPostPublic: boolean;
  maxPublicPostsPerMonth: number;
  maxBroadcastsPerMonth: number;

  // Throughput
  maxActiveRoutes: number;

  updatedAt: string;
};

export type SeekerEntitlements = {
  scope: "SEEKER";
  tier: SeekerTier;

  // Reach / throughput placeholders for future seeker-side monetization.
  maxSubcontractors: number;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;

  updatedAt: string;
};

type EntitlementsState = {
  retainers: Record<string, RetainerEntitlements>;
  seekers: Record<string, SeekerEntitlements>;
  updatedAt: string;
};

const KEY = "snapdriver_entitlements_v1";
const SCHEMA_VERSION = 1;
const SEEKER_TRIAL_DAYS = 90;

function nowIso() {
  return new Date().toISOString();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function defaultRetainerEntitlements(): RetainerEntitlements {
  return {
    scope: "RETAINER",
    tier: "STARTER",
    maxUsers: 3,
    canPostPublic: false,
    maxPublicPostsPerMonth: 0,
    maxBroadcastsPerMonth: 10,
    maxActiveRoutes: 3,
    updatedAt: nowIso(),
  };
}

function defaultSeekerEntitlements(): SeekerEntitlements {
  const startedAt = nowIso();
  const endsAt = addDays(new Date(startedAt), SEEKER_TRIAL_DAYS).toISOString();
  return {
    scope: "SEEKER",
    tier: "TRIAL",
    maxSubcontractors: 8,
    trialStartedAt: startedAt,
    trialEndsAt: endsAt,
    updatedAt: nowIso(),
  };
}

function tierToRetainerEntitlements(tier: RetainerTier): RetainerEntitlements {
  const base = defaultRetainerEntitlements();
  if (tier === "STARTER") {
    return {
      ...base,
      tier,
      maxUsers: 3,
      maxBroadcastsPerMonth: 10,
      maxActiveRoutes: 3,
      updatedAt: nowIso(),
    };
  }
  if (tier === "GROWTH") {
    return {
      ...base,
      tier,
      maxUsers: 15,
      canPostPublic: true,
      maxPublicPostsPerMonth: 25,
      maxBroadcastsPerMonth: 50,
      maxActiveRoutes: 15,
      updatedAt: nowIso(),
    };
  }
  if (tier === "ENTERPRISE") {
    return {
      ...base,
      tier,
      maxUsers: 100,
      canPostPublic: true,
      maxPublicPostsPerMonth: 9999,
      maxBroadcastsPerMonth: 9999,
      maxActiveRoutes: 9999,
      updatedAt: nowIso(),
    };
  }
  return { ...base, tier, updatedAt: nowIso() };
}

function tierToSeekerEntitlements(tier: SeekerTier): SeekerEntitlements {
  const base = defaultSeekerEntitlements();
  if (tier === "TRIAL") {
    const startedAt = base.trialStartedAt ?? nowIso();
    const endsAt = base.trialEndsAt ?? addDays(new Date(startedAt), SEEKER_TRIAL_DAYS).toISOString();
    return {
      ...base,
      tier,
      trialStartedAt: startedAt,
      trialEndsAt: endsAt,
      updatedAt: nowIso(),
    };
  }
  if (tier === "STARTER") {
    return {
      ...base,
      tier,
      maxSubcontractors: 8,
      trialStartedAt: null,
      trialEndsAt: null,
      updatedAt: nowIso(),
    };
  }
  if (tier === "GROWTH") {
    return {
      ...base,
      tier,
      maxSubcontractors: 8,
      trialStartedAt: null,
      trialEndsAt: null,
      updatedAt: nowIso(),
    };
  }
  if (tier === "ELITE") {
    return {
      ...base,
      tier,
      maxSubcontractors: 8,
      trialStartedAt: null,
      trialEndsAt: null,
      updatedAt: nowIso(),
    };
  }
  return { ...base, tier, updatedAt: nowIso() };
}

function normalizeRetainerTier(raw: any): RetainerTier {
  return raw === "GROWTH" || raw === "ENTERPRISE" || raw === "STARTER" ? raw : "STARTER";
}

function normalizeSeekerTier(raw: any): SeekerTier {
  if (raw === "TRIAL" || raw === "STARTER" || raw === "GROWTH" || raw === "ELITE") return raw;
  if (raw === "PRO") return "STARTER";
  return "TRIAL";
}

function ensureTrialWindow(ent: SeekerEntitlements): SeekerEntitlements {
  if (ent.tier !== "TRIAL") {
    return { ...ent, trialStartedAt: null, trialEndsAt: null };
  }
  const startedAt = ent.trialStartedAt ?? nowIso();
  const endsAt = ent.trialEndsAt ?? addDays(new Date(startedAt), SEEKER_TRIAL_DAYS).toISOString();
  return { ...ent, trialStartedAt: startedAt, trialEndsAt: endsAt };
}

function loadState(): EntitlementsState {
  const parsed = readStoreData<unknown>(KEY);
  if (!parsed || typeof parsed !== "object") {
    return { retainers: {}, seekers: {}, updatedAt: nowIso() };
  }
  const obj = parsed as any;
  return {
    retainers: (obj.retainers && typeof obj.retainers === "object"
      ? obj.retainers
      : {}) as Record<string, RetainerEntitlements>,
    seekers: (obj.seekers && typeof obj.seekers === "object"
      ? obj.seekers
      : {}) as Record<string, SeekerEntitlements>,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : nowIso(),
  };
}

function saveState(next: EntitlementsState) {
  writeStore(KEY, SCHEMA_VERSION, { ...next, updatedAt: nowIso() });
}

export function getRetainerEntitlements(retainerId: string): RetainerEntitlements {
  if (!retainerId) return defaultRetainerEntitlements();
  const state = loadState();
  const existing = state.retainers[retainerId];
  if (!existing) return defaultRetainerEntitlements();
  const normalizedTier = normalizeRetainerTier(existing.tier);
  return {
    ...defaultRetainerEntitlements(),
    ...existing,
    scope: "RETAINER",
    tier: normalizedTier,
    updatedAt: existing.updatedAt || nowIso(),
  };
}

export function setRetainerTier(retainerId: string, tier: RetainerTier): RetainerEntitlements {
  if (!retainerId) return defaultRetainerEntitlements();
  const state = loadState();
  const ent = tierToRetainerEntitlements(normalizeRetainerTier(tier));
  const next: EntitlementsState = {
    ...state,
    retainers: { ...state.retainers, [retainerId]: ent },
  };
  saveState(next);
  return ent;
}

export function getSeekerEntitlements(seekerId: string): SeekerEntitlements {
  if (!seekerId) return defaultSeekerEntitlements();
  const state = loadState();
  const existing = state.seekers[seekerId];
  if (!existing) return defaultSeekerEntitlements();
  const normalizedTier = normalizeSeekerTier(existing.tier);
  const next = {
    ...defaultSeekerEntitlements(),
    ...existing,
    scope: "SEEKER",
    tier: normalizedTier,
    updatedAt: existing.updatedAt || nowIso(),
  };
  return ensureTrialWindow(next);
}

export function setSeekerTier(seekerId: string, tier: SeekerTier): SeekerEntitlements {
  if (!seekerId) return defaultSeekerEntitlements();
  const state = loadState();
  const ent = tierToSeekerEntitlements(normalizeSeekerTier(tier));
  const next: EntitlementsState = {
    ...state,
    seekers: { ...state.seekers, [seekerId]: ent },
  };
  saveState(next);
  return ent;
}

export function getSeekerTrialStatus(seekerId: string): {
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  endsAt: string | null;
} {
  if (!seekerId) return { isTrial: true, isExpired: false, daysRemaining: null, endsAt: null };
  const ent = getSeekerEntitlements(seekerId);
  if (ent.tier !== "TRIAL") {
    return { isTrial: false, isExpired: false, daysRemaining: null, endsAt: null };
  }
  const endsAt = ent.trialEndsAt ?? null;
  const endsTs = endsAt ? Date.parse(endsAt) : NaN;
  if (!Number.isFinite(endsTs)) {
    return { isTrial: true, isExpired: false, daysRemaining: null, endsAt: null };
  }
  const diffMs = endsTs - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / 86_400_000));
  return {
    isTrial: true,
    isExpired: diffMs <= 0,
    daysRemaining,
    endsAt,
  };
}

export function canSeekerLink(seekerId: string): { ok: boolean; reason?: string } {
  if (!seekerId) return { ok: false, reason: "Select a Seeker profile first." };
  const ent = getSeekerEntitlements(seekerId);
  if (ent.tier !== "TRIAL") return { ok: true };
  const status = getSeekerTrialStatus(seekerId);
  if (status.isExpired) {
    return { ok: false, reason: "Trial ended. Upgrade to request links." };
  }
  return {
    ok: false,
    reason: "Trial accounts can view profiles but cannot request links.",
  };
}

export function canRetainerPostPublic(retainerId: string): boolean {
  return getRetainerEntitlements(retainerId).canPostPublic;
}

export function canRetainerAddUser(retainerId: string, currentUsers: number): boolean {
  const ent = getRetainerEntitlements(retainerId);
  return Number.isFinite(ent.maxUsers) ? currentUsers < ent.maxUsers : true;
}

export function canSeekerAddSubcontractor(seekerId: string, currentSubs: number): boolean {
  const ent = getSeekerEntitlements(seekerId);
  return Number.isFinite(ent.maxSubcontractors)
    ? currentSubs < ent.maxSubcontractors
    : true;
}
