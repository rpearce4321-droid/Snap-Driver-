// src/lib/entitlements.ts
//
// Local-first entitlements ("hybrid monetization"): seats + reach + throughput.
// This is intentionally minimal and additive so we can iterate without breaking portals.

import { readStoreData, writeStore } from "./storage";

export type PlanScope = "RETAINER" | "SEEKER";

export type RetainerTier = "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE";
export type SeekerTier = "FREE" | "PRO";

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

  updatedAt: string;
};

type EntitlementsState = {
  retainers: Record<string, RetainerEntitlements>;
  seekers: Record<string, SeekerEntitlements>;
  updatedAt: string;
};

const KEY = "snapdriver_entitlements_v1";
const SCHEMA_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function defaultRetainerEntitlements(): RetainerEntitlements {
  return {
    scope: "RETAINER",
    tier: "FREE",
    maxUsers: 50,
    canPostPublic: false,
    maxPublicPostsPerMonth: 0,
    maxBroadcastsPerMonth: 0,
    maxActiveRoutes: 50,
    updatedAt: nowIso(),
  };
}

function defaultSeekerEntitlements(): SeekerEntitlements {
  return {
    scope: "SEEKER",
    tier: "FREE",
    maxSubcontractors: 8,
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
  if (tier === "PRO") {
    return {
      ...base,
      tier,
      maxSubcontractors: 8,
      updatedAt: nowIso(),
    };
  }
  return { ...base, tier, updatedAt: nowIso() };
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
  return {
    ...defaultRetainerEntitlements(),
    ...existing,
    scope: "RETAINER",
    updatedAt: existing.updatedAt || nowIso(),
  };
}

export function setRetainerTier(retainerId: string, tier: RetainerTier): RetainerEntitlements {
  if (!retainerId) return defaultRetainerEntitlements();
  const state = loadState();
  const ent = tierToRetainerEntitlements(tier);
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
  return {
    ...defaultSeekerEntitlements(),
    ...existing,
    scope: "SEEKER",
    updatedAt: existing.updatedAt || nowIso(),
  };
}

export function setSeekerTier(seekerId: string, tier: SeekerTier): SeekerEntitlements {
  if (!seekerId) return defaultSeekerEntitlements();
  const state = loadState();
  const ent = tierToSeekerEntitlements(tier);
  const next: EntitlementsState = {
    ...state,
    seekers: { ...state.seekers, [seekerId]: ent },
  };
  saveState(next);
  return ent;
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
