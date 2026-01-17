// src/lib/routes.ts
//
// Local-first Routes + "Interested" signals.
// This is the first monetizable object (see docs/ROADMAP.md Phase 4).

import { getRetainerEntitlements } from "./entitlements";
import { getLinksForSeeker } from "./linking";
import type { DayOfWeek } from "./schedule";
import { isDayOfWeek, parseHHMM } from "./schedule";
import { readStoreData, writeStore } from "./storage";

export type RouteAudience = "LINKED_ONLY" | "PUBLIC";
export type RouteStatus = "ACTIVE" | "PAUSED" | "CLOSED";
export type RouteCommitmentType = "DEDICATED" | "FLEX";

export type Route = {
  id: string;
  retainerId: string;

  title: string;
  vertical?: string;
  city?: string;
  state?: string;

  schedule?: string;
  scheduleDays?: DayOfWeek[];
  scheduleStart?: string; // "HH:MM"
  scheduleEnd?: string; // "HH:MM"
  scheduleTimezone?: string;
  payModel?: string;
  payMin?: number;
  payMax?: number;
  openings?: number;
  requirements?: string;

  commitmentType: RouteCommitmentType;

  audience: RouteAudience;
  status: RouteStatus;

  createdAt: string;
  updatedAt: string;
};

export type RouteInterest = {
  id: string;
  routeId: string;
  seekerId: string;
  createdAt: string;
};

const ROUTES_KEY = "snapdriver_routes_v1";
const INTERESTS_KEY = "snapdriver_route_interests_v1";

const ROUTES_SCHEMA_VERSION = 1;
const INTERESTS_SCHEMA_VERSION = 1;

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

function normalizeRoute(raw: any): Route | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id || !raw.retainerId) return null;

  const audience: RouteAudience = raw.audience === "PUBLIC" ? "PUBLIC" : "LINKED_ONLY";
  const status: RouteStatus =
    raw.status === "PAUSED" || raw.status === "CLOSED" ? raw.status : "ACTIVE";

  const commitmentType: RouteCommitmentType =
    raw.commitmentType === "DEDICATED" ? "DEDICATED" : "FLEX";

  return {
    id: String(raw.id),
    retainerId: String(raw.retainerId),
    title: String(raw.title ?? "Route"),
    vertical: typeof raw.vertical === "string" ? raw.vertical : undefined,
    city: typeof raw.city === "string" ? raw.city : undefined,
    state: typeof raw.state === "string" ? raw.state : undefined,
    schedule: typeof raw.schedule === "string" ? raw.schedule : undefined,
    scheduleDays: Array.isArray(raw.scheduleDays)
      ? raw.scheduleDays.filter(isDayOfWeek)
      : undefined,
    scheduleStart:
      typeof raw.scheduleStart === "string" && parseHHMM(raw.scheduleStart) != null
        ? raw.scheduleStart
        : undefined,
    scheduleEnd:
      typeof raw.scheduleEnd === "string" && parseHHMM(raw.scheduleEnd) != null
        ? raw.scheduleEnd
        : undefined,
    scheduleTimezone: typeof raw.scheduleTimezone === "string" ? raw.scheduleTimezone : undefined,
    payModel: typeof raw.payModel === "string" ? raw.payModel : undefined,
    payMin: Number.isFinite(raw.payMin) ? Number(raw.payMin) : undefined,
    payMax: Number.isFinite(raw.payMax) ? Number(raw.payMax) : undefined,
    openings: Number.isFinite(raw.openings) ? Number(raw.openings) : undefined,
    requirements: typeof raw.requirements === "string" ? raw.requirements : undefined,
    commitmentType,
    audience,
    status,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function scheduleSummary(days: DayOfWeek[], start: string, end: string, timezone?: string): string {
  const short = (days || [])
    .map((d) => {
      switch (d) {
        case "MON":
          return "Mon";
        case "TUE":
          return "Tue";
        case "WED":
          return "Wed";
        case "THU":
          return "Thu";
        case "FRI":
          return "Fri";
        case "SAT":
          return "Sat";
        case "SUN":
          return "Sun";
        default:
          return d;
      }
    })
    .join(", ");
  const tz = timezone ? ` (${timezone})` : "";
  return `${short} ${start}-${end}${tz}`.trim();
}

function normalizeScheduleFields(input: {
  scheduleDays?: DayOfWeek[];
  scheduleStart?: string;
  scheduleEnd?: string;
  scheduleTimezone?: string;
}): { scheduleDays?: DayOfWeek[]; scheduleStart?: string; scheduleEnd?: string; scheduleTimezone?: string } {
  const scheduleDays = Array.isArray(input.scheduleDays)
    ? input.scheduleDays.filter(isDayOfWeek)
    : undefined;

  const scheduleStart =
    typeof input.scheduleStart === "string" && parseHHMM(input.scheduleStart) != null
      ? input.scheduleStart
      : undefined;
  const scheduleEnd =
    typeof input.scheduleEnd === "string" && parseHHMM(input.scheduleEnd) != null
      ? input.scheduleEnd
      : undefined;

  if (scheduleDays && scheduleDays.length > 0 && scheduleStart && scheduleEnd) {
    const s = parseHHMM(scheduleStart);
    const e = parseHHMM(scheduleEnd);
    if (s == null || e == null || e <= s) {
      throw new Error("Schedule end time must be after start time.");
    }
    return {
      scheduleDays,
      scheduleStart,
      scheduleEnd,
      scheduleTimezone: typeof input.scheduleTimezone === "string" ? input.scheduleTimezone : undefined,
    };
  }

  // If partially specified, drop to undefined so callers don't think it's matchable.
  if (input.scheduleDays || input.scheduleStart || input.scheduleEnd) {
    return {
      scheduleDays: undefined,
      scheduleStart: undefined,
      scheduleEnd: undefined,
      scheduleTimezone: typeof input.scheduleTimezone === "string" ? input.scheduleTimezone : undefined,
    };
  }

  return {
    scheduleDays: undefined,
    scheduleStart: undefined,
    scheduleEnd: undefined,
    scheduleTimezone: typeof input.scheduleTimezone === "string" ? input.scheduleTimezone : undefined,
  };
}

function normalizeInterest(raw: any): RouteInterest | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.routeId || !raw.seekerId) return null;
  return {
    id: String(raw.id || makeId("interest")),
    routeId: String(raw.routeId),
    seekerId: String(raw.seekerId),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
  };
}

function loadRoutes(): Route[] {
  const parsed = readStoreData<unknown>(ROUTES_KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[])
    .map(normalizeRoute)
    .filter((x): x is Route => x !== null);
}

function saveRoutes(list: Route[]) {
  writeStore(ROUTES_KEY, ROUTES_SCHEMA_VERSION, list);
}

function loadInterests(): RouteInterest[] {
  const parsed = readStoreData<unknown>(INTERESTS_KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[])
    .map(normalizeInterest)
    .filter((x): x is RouteInterest => x !== null);
}

function saveInterests(list: RouteInterest[]) {
  writeStore(INTERESTS_KEY, INTERESTS_SCHEMA_VERSION, list);
}

export function getAllRoutes(): Route[] {
  return loadRoutes().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getRoutesForRetainer(retainerId: string): Route[] {
  if (!retainerId) return [];
  return getAllRoutes().filter((r) => r.retainerId === retainerId);
}

function countActiveRoutesForRetainer(retainerId: string): number {
  return getRoutesForRetainer(retainerId).filter((r) => r.status === "ACTIVE").length;
}

function assertRouteCreateAllowed(retainerId: string, audience: RouteAudience) {
  const ent = getRetainerEntitlements(retainerId);
  const active = countActiveRoutesForRetainer(retainerId);
  if (Number.isFinite(ent.maxActiveRoutes) && active >= ent.maxActiveRoutes) {
    throw new Error(`Route limit reached for tier (${ent.tier}).`);
  }
  if (audience === "PUBLIC" && !ent.canPostPublic) {
    throw new Error(`Public routes require a higher tier (current: ${ent.tier}).`);
  }
}

export function createRoute(input: {
  retainerId: string;
  title: string;
  audience: RouteAudience;
  vertical?: string;
  city?: string;
  state?: string;
  schedule?: string;
  scheduleDays?: DayOfWeek[];
  scheduleStart?: string;
  scheduleEnd?: string;
  scheduleTimezone?: string;
  payModel?: string;
  payMin?: number;
  payMax?: number;
  openings?: number;
  requirements?: string;
  commitmentType?: RouteCommitmentType;
}): Route {
  const retainerId = String(input.retainerId || "").trim();
  if (!retainerId) throw new Error("retainerId is required");
  const title = String(input.title || "").trim();
  if (!title) throw new Error("title is required");

  const audience: RouteAudience = input.audience === "PUBLIC" ? "PUBLIC" : "LINKED_ONLY";
  assertRouteCreateAllowed(retainerId, audience);

  const sched = normalizeScheduleFields({
    scheduleDays: input.scheduleDays,
    scheduleStart: input.scheduleStart,
    scheduleEnd: input.scheduleEnd,
    scheduleTimezone: input.scheduleTimezone,
  });

  const ts = nowIso();
  const route: Route = {
    id: makeId("route"),
    retainerId,
    title,
    vertical: input.vertical?.trim() || undefined,
    city: input.city?.trim() || undefined,
    state: input.state?.trim() || undefined,
    schedule:
      input.schedule?.trim() ||
      (sched.scheduleDays && sched.scheduleStart && sched.scheduleEnd
        ? scheduleSummary(
            sched.scheduleDays,
            sched.scheduleStart,
            sched.scheduleEnd,
            sched.scheduleTimezone
          )
        : undefined),
    scheduleDays: sched.scheduleDays,
    scheduleStart: sched.scheduleStart,
    scheduleEnd: sched.scheduleEnd,
    scheduleTimezone: sched.scheduleTimezone,
    payModel: input.payModel?.trim() || undefined,
    payMin: Number.isFinite(input.payMin) ? Number(input.payMin) : undefined,
    payMax: Number.isFinite(input.payMax) ? Number(input.payMax) : undefined,
    openings: Number.isFinite(input.openings) ? Number(input.openings) : undefined,
    requirements: input.requirements?.trim() || undefined,
    commitmentType: input.commitmentType === "DEDICATED" ? "DEDICATED" : "FLEX",
    audience,
    status: "ACTIVE",
    createdAt: ts,
    updatedAt: ts,
  };

  const all = loadRoutes();
  all.push(route);
  saveRoutes(all);
  return route;
}

export function updateRoute(routeId: string, patch: Partial<Omit<Route, "id" | "retainerId" | "createdAt">>): Route | null {
  if (!routeId) return null;
  const all = loadRoutes();
  const idx = all.findIndex((r) => r.id === routeId);
  if (idx < 0) return null;

  const current = all[idx];
  const nextAudience: RouteAudience =
    patch.audience === "PUBLIC" ? "PUBLIC" : patch.audience === "LINKED_ONLY" ? "LINKED_ONLY" : current.audience;

  if (nextAudience === "PUBLIC" && !getRetainerEntitlements(current.retainerId).canPostPublic) {
    throw new Error("Public routes require a higher tier.");
  }

  const nextStatus: RouteStatus =
    patch.status === "PAUSED" || patch.status === "CLOSED" || patch.status === "ACTIVE"
      ? patch.status
      : current.status;

  // If moving to ACTIVE from a non-ACTIVE status, ensure we don't exceed active cap.
  if (current.status !== "ACTIVE" && nextStatus === "ACTIVE") {
    assertRouteCreateAllowed(current.retainerId, nextAudience);
  }

  const updated: Route = {
    ...current,
    title: typeof patch.title === "string" ? patch.title : current.title,
    vertical: typeof patch.vertical === "string" ? patch.vertical : current.vertical,
    city: typeof patch.city === "string" ? patch.city : current.city,
    state: typeof patch.state === "string" ? patch.state : current.state,
    schedule: typeof patch.schedule === "string" ? patch.schedule : current.schedule,
    scheduleDays: Array.isArray(patch.scheduleDays)
      ? (patch.scheduleDays as any[]).filter(isDayOfWeek)
      : current.scheduleDays,
    scheduleStart:
      typeof patch.scheduleStart === "string" && parseHHMM(patch.scheduleStart) != null
        ? patch.scheduleStart
        : current.scheduleStart,
    scheduleEnd:
      typeof patch.scheduleEnd === "string" && parseHHMM(patch.scheduleEnd) != null
        ? patch.scheduleEnd
        : current.scheduleEnd,
    scheduleTimezone:
      typeof patch.scheduleTimezone === "string" ? patch.scheduleTimezone : current.scheduleTimezone,
    payModel: typeof patch.payModel === "string" ? patch.payModel : current.payModel,
    payMin: Number.isFinite(patch.payMin as any) ? Number(patch.payMin) : current.payMin,
    payMax: Number.isFinite(patch.payMax as any) ? Number(patch.payMax) : current.payMax,
    openings: Number.isFinite(patch.openings as any) ? Number(patch.openings) : current.openings,
    requirements: typeof patch.requirements === "string" ? patch.requirements : current.requirements,
    commitmentType:
      patch.commitmentType === "DEDICATED"
        ? "DEDICATED"
        : patch.commitmentType === "FLEX"
        ? "FLEX"
        : current.commitmentType,
    audience: nextAudience,
    status: nextStatus,
    updatedAt: nowIso(),
  };

  if (updated.scheduleDays && updated.scheduleDays.length > 0 && updated.scheduleStart && updated.scheduleEnd) {
    const s = parseHHMM(updated.scheduleStart);
    const e = parseHHMM(updated.scheduleEnd);
    if (s == null || e == null || e <= s) {
      throw new Error("Schedule end time must be after start time.");
    }
  }

  all[idx] = updated;
  saveRoutes(all);
  return updated;
}

export function getVisibleRoutesForSeeker(seekerId: string): Route[] {
  const all = getAllRoutes().filter((r) => r.status === "ACTIVE");
  if (!seekerId) return all.filter((r) => r.audience === "PUBLIC");

  const activeLinkedRetainerIds = new Set(
    getLinksForSeeker(seekerId)
      .filter((l) => l.status === "ACTIVE")
      .map((l) => l.retainerId)
  );

  return all.filter((r) => {
    if (r.audience === "PUBLIC") return true;
    return activeLinkedRetainerIds.has(r.retainerId);
  });
}

export function getAllRouteInterests(): RouteInterest[] {
  return loadInterests().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getInterestsForRoute(routeId: string): RouteInterest[] {
  if (!routeId) return [];
  return getAllRouteInterests().filter((x) => x.routeId === routeId);
}

export function getInterestsForSeeker(seekerId: string): RouteInterest[] {
  if (!seekerId) return [];
  return getAllRouteInterests().filter((x) => x.seekerId === seekerId);
}

export function isInterested(seekerId: string, routeId: string): boolean {
  if (!seekerId || !routeId) return false;
  return loadInterests().some((i) => i.seekerId === seekerId && i.routeId === routeId);
}

export function toggleInterest(seekerId: string, routeId: string): { interested: boolean } {
  if (!seekerId || !routeId) throw new Error("seekerId and routeId are required");
  const all = loadInterests();
  const idx = all.findIndex((i) => i.seekerId === seekerId && i.routeId === routeId);
  if (idx >= 0) {
    all.splice(idx, 1);
    saveInterests(all);
    return { interested: false };
  }
  all.push({ id: makeId("interest"), seekerId, routeId, createdAt: nowIso() });
  saveInterests(all);
  return { interested: true };
}
