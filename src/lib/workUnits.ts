// src/lib/workUnits.ts
//
// Minimal work-unit tracking to tie scoring to actual work completion.
// Stores counts only; no route-ops detail.

import { readStoreData, writeStore } from "./storage";
import type { PayCycleFrequency } from "./data";
import { submitWorkCompletionCheckin } from "./badges";

export type WorkUnitCadence = PayCycleFrequency;
export type WorkUnitAssignmentType = "DEDICATED" | "ON_DEMAND";
export type WorkUnitType = "DAY" | "SHIFT" | "JOB";
export type WorkUnitPeriodStatus = "PENDING" | "CONFIRMED" | "DISPUTED" | "AUTO_APPROVED";
export type WorkUnitResponse = "CONFIRM" | "DISPUTE" | "NEUTRAL" | "NONE";

export type RouteAssignment = {
  id: string;
  routeId: string;
  retainerId: string;
  seekerId: string;
  assignmentType: WorkUnitAssignmentType;
  unitType: WorkUnitType;
  cadence: WorkUnitCadence;
  expectedUnitsPerPeriod?: number; // required for DEDICATED
  startDate: string; // ISO
  status: "ACTIVE" | "PAUSED" | "ENDED";
  createdAt: string;
  updatedAt: string;
};

export type WorkUnitPeriod = {
  id: string;
  assignmentId: string;
  periodKey: string; // ex: 2026-W06 or 2026-02
  cadence: WorkUnitCadence;
  expectedUnits?: number; // for DEDICATED
  acceptedUnits?: number; // for ON_DEMAND
  completedUnits?: number;
  missedUnits?: number;
  status: WorkUnitPeriodStatus;
  seekerResponse: WorkUnitResponse;
  adminResolution: WorkUnitResponse;
  disputeNote?: string;
  adminNote?: string;
  retainerSubmittedAt?: string;
  seekerRespondedAt?: string;
  windowClosesAt?: string;
  createdAt: string;
  updatedAt: string;
};

const ASSIGNMENTS_KEY = "snapdriver_route_assignments_v1";
const PERIODS_KEY = "snapdriver_work_unit_periods_v1";
const SCHEMA_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function monthKeyFromIso(value?: string | null): string {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.valueOf())) return "";
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dt.getFullYear()}-${month}`;
}

function makeId(prefix: string) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rnd}`;
}

function clampCount(value: any): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.floor(n));
}

function normalizeAssignment(raw: any): RouteAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id || !raw.routeId || !raw.retainerId || !raw.seekerId) return null;
  const assignmentType: WorkUnitAssignmentType =
    raw.assignmentType === "ON_DEMAND" ? "ON_DEMAND" : "DEDICATED";
  const unitType: WorkUnitType =
    raw.unitType === "SHIFT" || raw.unitType === "JOB" ? raw.unitType : "DAY";
  const cadence: WorkUnitCadence =
    raw.cadence === "BIWEEKLY" || raw.cadence === "MONTHLY" ? raw.cadence : "WEEKLY";
  const status: RouteAssignment["status"] =
    raw.status === "PAUSED" || raw.status === "ENDED" ? raw.status : "ACTIVE";
  return {
    id: String(raw.id),
    routeId: String(raw.routeId),
    retainerId: String(raw.retainerId),
    seekerId: String(raw.seekerId),
    assignmentType,
    unitType,
    cadence,
    expectedUnitsPerPeriod: clampCount(raw.expectedUnitsPerPeriod),
    startDate: typeof raw.startDate === "string" ? raw.startDate : nowIso(),
    status,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function normalizePeriod(raw: any): WorkUnitPeriod | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id || !raw.assignmentId || !raw.periodKey) return null;
  const cadence: WorkUnitCadence =
    raw.cadence === "BIWEEKLY" || raw.cadence === "MONTHLY" ? raw.cadence : "WEEKLY";
  const status: WorkUnitPeriodStatus =
    raw.status === "CONFIRMED" || raw.status === "DISPUTED" || raw.status === "AUTO_APPROVED"
      ? raw.status
      : "PENDING";
  return {
    id: String(raw.id),
    assignmentId: String(raw.assignmentId),
    periodKey: String(raw.periodKey),
    cadence,
    expectedUnits: clampCount(raw.expectedUnits),
    acceptedUnits: clampCount(raw.acceptedUnits),
    completedUnits: clampCount(raw.completedUnits),
    missedUnits: clampCount(raw.missedUnits),
    status,
    seekerResponse:
      raw.seekerResponse === "CONFIRM" || raw.seekerResponse === "DISPUTE" || raw.seekerResponse === "NEUTRAL"
        ? raw.seekerResponse
        : "NONE",
    adminResolution:
      raw.adminResolution === "CONFIRM" || raw.adminResolution === "DISPUTE" || raw.adminResolution === "NEUTRAL"
        ? raw.adminResolution
        : "NONE",
    disputeNote: typeof raw.disputeNote === "string" ? raw.disputeNote : undefined,
    adminNote: typeof raw.adminNote === "string" ? raw.adminNote : undefined,
    retainerSubmittedAt: typeof raw.retainerSubmittedAt === "string" ? raw.retainerSubmittedAt : undefined,
    seekerRespondedAt: typeof raw.seekerRespondedAt === "string" ? raw.seekerRespondedAt : undefined,
    windowClosesAt: typeof raw.windowClosesAt === "string" ? raw.windowClosesAt : undefined,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function loadAssignments(): RouteAssignment[] {
  const parsed = readStoreData<unknown>(ASSIGNMENTS_KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[]).map(normalizeAssignment).filter((x): x is RouteAssignment => x !== null);
}

function saveAssignments(list: RouteAssignment[]) {
  writeStore(ASSIGNMENTS_KEY, SCHEMA_VERSION, list);
}

function loadPeriods(): WorkUnitPeriod[] {
  const parsed = readStoreData<unknown>(PERIODS_KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[]).map(normalizePeriod).filter((x): x is WorkUnitPeriod => x !== null);
}

function savePeriods(list: WorkUnitPeriod[]) {
  writeStore(PERIODS_KEY, SCHEMA_VERSION, list);
}

export function getRouteAssignments(): RouteAssignment[] {
  return loadAssignments().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getAssignmentById(id: string): RouteAssignment | null {
  if (!id) return null;
  return getRouteAssignments().find((a) => a.id === id) ?? null;
}

export function getAssignmentsForSeeker(seekerId: string): RouteAssignment[] {
  if (!seekerId) return [];
  return getRouteAssignments().filter((a) => a.seekerId === seekerId);
}

export function getAssignmentsForRetainer(retainerId: string): RouteAssignment[] {
  if (!retainerId) return [];
  return getRouteAssignments().filter((a) => a.retainerId === retainerId);
}

export function createRouteAssignment(input: {
  routeId: string;
  retainerId: string;
  seekerId: string;
  assignmentType: WorkUnitAssignmentType;
  unitType?: WorkUnitType;
  cadence: WorkUnitCadence;
  expectedUnitsPerPeriod?: number;
  startDate?: string;
}): RouteAssignment {
  const routeId = String(input.routeId || "").trim();
  const retainerId = String(input.retainerId || "").trim();
  const seekerId = String(input.seekerId || "").trim();
  if (!routeId || !retainerId || !seekerId) {
    throw new Error("routeId, retainerId, and seekerId are required.");
  }

  const assignmentType: WorkUnitAssignmentType =
    input.assignmentType === "ON_DEMAND" ? "ON_DEMAND" : "DEDICATED";
  const unitType: WorkUnitType =
    input.unitType ?? (assignmentType === "ON_DEMAND" ? "JOB" : "DAY");
  const cadence: WorkUnitCadence =
    input.cadence === "BIWEEKLY" || input.cadence === "MONTHLY" ? input.cadence : "WEEKLY";

  const expectedUnits =
    assignmentType === "DEDICATED"
      ? clampCount(input.expectedUnitsPerPeriod)
      : undefined;
  if (assignmentType === "DEDICATED" && (!expectedUnits || expectedUnits <= 0)) {
    throw new Error("expectedUnitsPerPeriod is required for DEDICATED assignments.");
  }

  const ts = nowIso();
  const assignment: RouteAssignment = {
    id: makeId("assign"),
    routeId,
    retainerId,
    seekerId,
    assignmentType,
    unitType,
    cadence,
    expectedUnitsPerPeriod: expectedUnits,
    startDate: typeof input.startDate === "string" ? input.startDate : ts,
    status: "ACTIVE",
    createdAt: ts,
    updatedAt: ts,
  };

  const all = loadAssignments();
  all.push(assignment);
  saveAssignments(all);
  return assignment;
}

export function updateRouteAssignment(
  assignmentId: string,
  patch: Partial<Omit<RouteAssignment, "id" | "routeId" | "retainerId" | "seekerId" | "createdAt">>
): RouteAssignment | null {
  if (!assignmentId) return null;
  const all = loadAssignments();
  const idx = all.findIndex((a) => a.id === assignmentId);
  if (idx < 0) return null;
  const current = all[idx];
  const next: RouteAssignment = {
    ...current,
    assignmentType:
      patch.assignmentType === "ON_DEMAND" || patch.assignmentType === "DEDICATED"
        ? patch.assignmentType
        : current.assignmentType,
    unitType:
      patch.unitType === "DAY" || patch.unitType === "SHIFT" || patch.unitType === "JOB"
        ? patch.unitType
        : current.unitType,
    cadence:
      patch.cadence === "BIWEEKLY" || patch.cadence === "MONTHLY" || patch.cadence === "WEEKLY"
        ? patch.cadence
        : current.cadence,
    expectedUnitsPerPeriod:
      patch.expectedUnitsPerPeriod != null ? clampCount(patch.expectedUnitsPerPeriod) : current.expectedUnitsPerPeriod,
    startDate: typeof patch.startDate === "string" ? patch.startDate : current.startDate,
    status: patch.status ?? current.status,
    updatedAt: nowIso(),
  };
  all[idx] = next;
  saveAssignments(all);
  return next;
}

export function getWorkUnitPeriods(): WorkUnitPeriod[] {
  return loadPeriods().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getPeriodsForAssignment(assignmentId: string): WorkUnitPeriod[] {
  if (!assignmentId) return [];
  return getWorkUnitPeriods().filter((p) => p.assignmentId === assignmentId);
}

export function getPeriodById(periodId: string): WorkUnitPeriod | null {
  if (!periodId) return null;
  return getWorkUnitPeriods().find((p) => p.id === periodId) ?? null;
}

export function getPeriodByKey(assignmentId: string, periodKey: string): WorkUnitPeriod | null {
  if (!assignmentId || !periodKey) return null;
  return getWorkUnitPeriods().find((p) => p.assignmentId === assignmentId && p.periodKey === periodKey) ?? null;
}

export function createWorkUnitPeriod(input: {
  assignmentId: string;
  periodKey: string;
  cadence: WorkUnitCadence;
  expectedUnits?: number;
  acceptedUnits?: number;
}): WorkUnitPeriod {
  const assignmentId = String(input.assignmentId || "").trim();
  const periodKey = String(input.periodKey || "").trim();
  if (!assignmentId || !periodKey) {
    throw new Error("assignmentId and periodKey are required.");
  }
  const ts = nowIso();
  const period: WorkUnitPeriod = {
    id: makeId("period"),
    assignmentId,
    periodKey,
    cadence:
      input.cadence === "BIWEEKLY" || input.cadence === "MONTHLY" ? input.cadence : "WEEKLY",
    expectedUnits: clampCount(input.expectedUnits),
    acceptedUnits: clampCount(input.acceptedUnits),
    completedUnits: undefined,
    missedUnits: undefined,
    status: "PENDING",
    seekerResponse: "NONE",
    adminResolution: "NONE",
    createdAt: ts,
    updatedAt: ts,
  };
  const all = loadPeriods();
  all.push(period);
  savePeriods(all);
  return period;
}

export function submitWorkUnitCounts(args: {
  periodId: string;
  completedUnits: number;
  missedUnits?: number;
  acceptedUnits?: number;
  expectedUnits?: number;
  submittedAt?: string;
}): WorkUnitPeriod | null {
  const period = getPeriodById(args.periodId);
  if (!period) return null;
  const assignment = getAssignmentById(period.assignmentId);
  if (!assignment) return null;
  const completed = Math.max(0, Math.floor(args.completedUnits));
  const accepted =
    clampCount(args.acceptedUnits) ?? period.acceptedUnits ?? (assignment.assignmentType === "ON_DEMAND" ? 0 : undefined);
  const expected =
    clampCount(args.expectedUnits) ??
    period.expectedUnits ??
    (assignment.assignmentType === "DEDICATED" ? assignment.expectedUnitsPerPeriod : undefined);
  if (assignment.assignmentType === "DEDICATED" && (!expected || expected <= 0)) {
    throw new Error("expectedUnits is required for DEDICATED work periods.");
  }
  if (assignment.assignmentType === "ON_DEMAND" && accepted == null) {
    throw new Error("acceptedUnits is required for ON_DEMAND work periods.");
  }
  const missed =
    args.missedUnits != null
      ? Math.max(0, Math.floor(args.missedUnits))
      : typeof accepted === "number"
        ? Math.max(0, accepted - completed)
        : typeof expected === "number"
          ? Math.max(0, expected - completed)
          : 0;

  const ts = typeof args.submittedAt === "string" ? args.submittedAt : nowIso();
  const windowClosesAt = new Date(Date.parse(ts) + 48 * 60 * 60 * 1000).toISOString();

  const next: WorkUnitPeriod = {
    ...period,
    acceptedUnits: accepted,
    expectedUnits: expected,
    completedUnits: completed,
    missedUnits: missed,
    status: "PENDING",
    retainerSubmittedAt: ts,
    windowClosesAt,
    updatedAt: ts,
  };

  const all = loadPeriods();
  const idx = all.findIndex((p) => p.id === period.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  savePeriods(all);
  return next;
}

export function respondToWorkUnitPeriod(args: {
  periodId: string;
  response: WorkUnitResponse;
  disputeNote?: string;
}): WorkUnitPeriod | null {
  const period = getPeriodById(args.periodId);
  if (!period) return null;
  const ts = nowIso();
  const response =
    args.response === "CONFIRM" || args.response === "DISPUTE" || args.response === "NEUTRAL"
      ? args.response
      : "NONE";

  if (response === "DISPUTE") {
    const assignment = getAssignmentById(period.assignmentId);
    if (assignment) {
      const monthKey = monthKeyFromIso(ts);
      if (monthKey) {
        const all = loadPeriods();
        const conflict = all.some((p) => {
          if (p.id === period.id) return false;
          if (p.seekerResponse !== "DISPUTE") return false;
          if (!p.seekerRespondedAt) return false;
          if (monthKeyFromIso(p.seekerRespondedAt) !== monthKey) return false;
          const otherAssignment = getAssignmentById(p.assignmentId);
          if (!otherAssignment) return false;
          return (
            otherAssignment.seekerId === assignment.seekerId &&
            otherAssignment.retainerId === assignment.retainerId
          );
        });
        if (conflict) {
          throw new Error("Only one dispute per calendar month is allowed for this link.");
        }
      }
    }
  }

  const nextStatus: WorkUnitPeriodStatus =
    response === "DISPUTE" ? "DISPUTED" : response === "CONFIRM" ? "CONFIRMED" : "CONFIRMED";

  const next: WorkUnitPeriod = {
    ...period,
    status: nextStatus,
    seekerResponse: response,
    disputeNote: response === "DISPUTE" ? args.disputeNote?.trim() || undefined : undefined,
    seekerRespondedAt: ts,
    updatedAt: ts,
  };

  const all = loadPeriods();
  const idx = all.findIndex((p) => p.id === period.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  savePeriods(all);

  if (response === "CONFIRM") {
    finalizeWorkUnitPeriod(next);
  }

  return next;
}

export function autoApproveWorkUnitPeriod(periodId: string): WorkUnitPeriod | null {
  const period = getPeriodById(periodId);
  if (!period || period.status !== "PENDING") return null;
  const closesAt = period.windowClosesAt ? Date.parse(period.windowClosesAt) : 0;
  if (!closesAt || Date.now() < closesAt) return null;
  const ts = nowIso();
  const next: WorkUnitPeriod = {
    ...period,
    status: "AUTO_APPROVED",
    seekerResponse: "NONE",
    updatedAt: ts,
  };
  const all = loadPeriods();
  const idx = all.findIndex((p) => p.id === period.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  savePeriods(all);

  finalizeWorkUnitPeriod(next);
  return next;
}

export function resolveDisputedWorkUnitPeriod(args: {
  periodId: string;
  resolution: "CONFIRM" | "NEUTRAL" | "DISPUTE";
  completedUnits?: number;
  missedUnits?: number;
  adminNote?: string;
}): WorkUnitPeriod | null {
  const period = getPeriodById(args.periodId);
  if (!period) return null;
  const ts = nowIso();
  const resolution =
    args.resolution === "CONFIRM" || args.resolution === "NEUTRAL" ? args.resolution : "DISPUTE";

  const completed =
    args.completedUnits != null ? Math.max(0, Math.floor(args.completedUnits)) : period.completedUnits;
  const missed =
    args.missedUnits != null ? Math.max(0, Math.floor(args.missedUnits)) : period.missedUnits;

  const next: WorkUnitPeriod = {
    ...period,
    status: resolution === "DISPUTE" ? "DISPUTED" : "CONFIRMED",
    adminResolution: resolution,
    completedUnits: completed,
    missedUnits: missed,
    adminNote: args.adminNote?.trim() || undefined,
    updatedAt: ts,
  };

  const all = loadPeriods();
  const idx = all.findIndex((p) => p.id === period.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  savePeriods(all);

  if (resolution === "CONFIRM") {
    finalizeWorkUnitPeriod(next);
  }

  return next;
}

function finalizeWorkUnitPeriod(period: WorkUnitPeriod) {
  if (period.status !== "CONFIRMED" && period.status !== "AUTO_APPROVED") return;
  if (period.seekerResponse === "NEUTRAL") return;

  const assignment = getAssignmentById(period.assignmentId);
  if (!assignment) return;
  const completed = Math.max(0, Math.floor(period.completedUnits ?? 0));
  const missed = Math.max(0, Math.floor(period.missedUnits ?? 0));

  // Seeker badge (verified by retainer)
  try {
    submitWorkCompletionCheckin({
      ownerRole: "SEEKER",
      ownerId: assignment.seekerId,
      verifierRole: "RETAINER",
      verifierId: assignment.retainerId,
      seekerId: assignment.seekerId,
      retainerId: assignment.retainerId,
      periodKey: period.periodKey,
      cadence: period.cadence,
      completedUnits: completed,
      missedUnits: missed,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    });
  } catch {
    // ignore; badge submission enforces active link + working together
  }

  // Retainer badge (verified by seeker)
  try {
    submitWorkCompletionCheckin({
      ownerRole: "RETAINER",
      ownerId: assignment.retainerId,
      verifierRole: "SEEKER",
      verifierId: assignment.seekerId,
      seekerId: assignment.seekerId,
      retainerId: assignment.retainerId,
      periodKey: period.periodKey,
      cadence: period.cadence,
      completedUnits: completed,
      missedUnits: missed,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    });
  } catch {
    // ignore; badge submission enforces active link + working together
  }
}
