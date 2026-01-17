// src/lib/data.ts

import { readStoreData, removeStore, writeStore } from "./storage";
import { canRetainerAddUser, canSeekerAddSubcontractor } from "./entitlements";
import { disableLinksForRetainer, disableLinksForSeeker } from "./linking";
import { createConversationWithFirstMessage } from "./messages";
import type { WeeklyAvailability } from "./schedule";
import { isDayOfWeek, parseHHMM } from "./schedule";

// === Types ==================================================================

export type Status = "PENDING" | "APPROVED" | "REJECTED" | "DELETED" | "SUSPENDED";
export type Role = "SEEKER" | "RETAINER";

export type RetainerUserLevel = 1 | 2 | 3;

export type RetainerUserLevelLabels = {
  level1: string;
  level2: string;
  level3: string;
};

export type HierarchyNode = {
  id: string;
  x: number;
  y: number;
  parentId?: string;
};

export type RetainerUser = {
  id: string;
  retainerId: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  bio?: string;
  level: RetainerUserLevel;
  createdAt: number;
};

export type Subcontractor = {
  id: string;
  seekerId: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  bio?: string;
  createdAt: number;
};

export type SeekerRef = {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
};

export type Seeker = {
  id: string;
  role: "SEEKER";
  status: Status;
  firstName: string;
  lastName: string;
  companyName?: string;
  birthday?: string;
  city?: string;
  state?: string;
  zip?: string;
  yearsInBusiness?: number;
  deliveryVerticals?: string[];
  vehicle?: string;
  insuranceType?: string;
  ref1?: SeekerRef;
  ref2?: SeekerRef;
  availability?: WeeklyAvailability;
  createdAt: number;
  subcontractors?: Subcontractor[];
  hierarchyNodes?: HierarchyNode[];
};

export type PaymentTerm =
  | "WEEKLY"
  | "BIWEEKLY"
  | "TWICE_MONTHLY"
  | "MONTHLY"
  | "NET_7"
  | "NET_14"
  | "NET_30";

export const PAYMENT_TERMS: Array<{ value: PaymentTerm; label: string }> = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Every two weeks" },
  { value: "TWICE_MONTHLY", label: "Twice monthly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "NET_7", label: "Net 7" },
  { value: "NET_14", label: "Net 14" },
  { value: "NET_30", label: "Net 30" },
];

export type RetainerFeeCadence = "PER_PAY" | "PER_ROUTE" | "MONTHLY" | "ONE_TIME";

export const RETAINER_FEE_CADENCE_OPTIONS: Array<{
  value: RetainerFeeCadence;
  label: string;
}> = [
  { value: "PER_PAY", label: "Per pay cycle" },
  { value: "PER_ROUTE", label: "Per route" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ONE_TIME", label: "One-time" },
];

export type RetainerFee = {
  id: string;
  label: string;
  amount: number;
  cadence: RetainerFeeCadence;
  description: string;
};

export type Retainer = {
  id: string;
  role: "RETAINER";
  status: Status;
  companyName: string;
  ceoName?: string;
  city?: string;
  state?: string;
  zip?: string;
  mission?: string;
  deliveryVerticals?: string[];
  employees?: number;
  yearsInBusiness?: number;
  desiredTraits?: string[];
  paymentTerms?: PaymentTerm;
  feeSchedule?: RetainerFee[];
  createdAt: number;
  users?: RetainerUser[];
  userLevelLabels?: RetainerUserLevelLabels;
  hierarchyNodes?: HierarchyNode[];
};

// === Environment / keys =====================================================

// Legacy keys (older versions)
const KEY_SEEKERS_OLD = "seekers";
const KEY_RETAINERS_OLD = "retainers";

// Current keys
const KEY_SEEKERS = "demo_seekers_v2";
const KEY_RETAINERS = "demo_retainers_v2";

const SEEKERS_SCHEMA_VERSION = 1;
const RETAINERS_SCHEMA_VERSION = 1;

const DEFAULT_RETAINER_LEVEL_LABELS: RetainerUserLevelLabels = {
  level1: "Level 1",
  level2: "Level 2",
  level3: "Level 3",
};

// === Option sets (used by forms / dropdowns) ================================

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export const DELIVERY_VERTICALS = [
  "Final mile parcel",
  "Same-day on-demand",
  "Medical / lab runs",
  "Retail distribution",
  "Grocery delivery",
  "Pharmacy routes",
  "B2B freight",
  "Furniture & appliances",
];

export const VERTICALS = DELIVERY_VERTICALS;

export const INSURANCE_TYPES = [
  "Commercial Auto",
  "Commercial Auto + Cargo",
  "General Liability + Auto",
  "Cargo Only",
];

export const TRAITS = [
  "On-time and reliable",
  "Customer-service focused",
  "Tech-savvy (apps, scanners)",
  "Comfortable with high stop counts",
  "Clean driving record",
  "Good communication",
  "Route optimization mindset",
  "Professional appearance",
];

export const STATUSES: Status[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "DELETED",
];

// === Helpers ================================================================

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 8)
  );
}

function now() {
  return Date.now();
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeHierarchyNodes(value: any): HierarchyNode[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((n) => n && typeof n.id === "string")
    .map((n) => ({
      id: String(n.id),
      x: Number.isFinite(n.x) ? Number(n.x) : 0,
      y: Number.isFinite(n.y) ? Number(n.y) : 0,
      parentId: typeof n.parentId === "string" ? n.parentId : undefined,
    }));
}

function normalizeRetainerUsers(value: any, retainerId: string): RetainerUser[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((u) => u && typeof u.id === "string")
    .map((u) => ({
      id: String(u.id),
      retainerId,
      firstName: String(u.firstName ?? "User"),
      lastName: String(u.lastName ?? ""),
      title: typeof u.title === "string" ? u.title : undefined,
      email: typeof u.email === "string" ? u.email : undefined,
      phone: typeof u.phone === "string" ? u.phone : undefined,
      photoUrl: typeof u.photoUrl === "string" ? u.photoUrl : undefined,
      bio: typeof u.bio === "string" ? u.bio : undefined,
      level: (u.level === 1 || u.level === 2 || u.level === 3 ? u.level : 1) as RetainerUserLevel,
      createdAt: Number.isFinite(u.createdAt) ? Number(u.createdAt) : now(),
    }));
}

function normalizeSubcontractors(value: any, seekerId: string): Subcontractor[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((u) => u && typeof u.id === "string")
    .map((u) => ({
      id: String(u.id),
      seekerId,
      firstName: String(u.firstName ?? "Sub"),
      lastName: String(u.lastName ?? "Contractor"),
      title: typeof u.title === "string" ? u.title : undefined,
      email: typeof u.email === "string" ? u.email : undefined,
      phone: typeof u.phone === "string" ? u.phone : undefined,
      photoUrl: typeof u.photoUrl === "string" ? u.photoUrl : undefined,
      bio: typeof u.bio === "string" ? u.bio : undefined,
      createdAt: Number.isFinite(u.createdAt) ? Number(u.createdAt) : now(),
    }));
}

// === LocalStorage helpers ===================================================

function readLS<T>(key: string): T | null {
  return readStoreData<T>(key);
}

function normalizeAvailability(value: any): WeeklyAvailability | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rawBlocks = (value as any).blocks;
  if (!Array.isArray(rawBlocks)) return undefined;

  const blocks = rawBlocks
    .filter((b) => b && typeof b === "object")
    .map((b) => ({
      day: (b as any).day,
      start: String((b as any).start ?? ""),
      end: String((b as any).end ?? ""),
    }))
    .filter((b) => isDayOfWeek(b.day))
    .filter((b) => {
      const s = parseHHMM(b.start);
      const e = parseHHMM(b.end);
      return s != null && e != null && e > s;
    })
    .map((b) => ({ day: b.day, start: b.start, end: b.end }));

  const timezone =
    typeof (value as any).timezone === "string" ? (value as any).timezone : undefined;

  return { timezone, blocks };
}

function writeLS<T>(key: string, value: T, schemaVersion: number) {
  writeStore(key, schemaVersion, value);
}

// === Legacy migration (if older keys exist) =================================

function migrateLegacySeekers(): Seeker[] | null {
  const legacy = readLS<any[]>(KEY_SEEKERS_OLD);
  if (!legacy || !Array.isArray(legacy)) return null;

  const mapped: Seeker[] = legacy.map((raw) => ({
    id: raw.id ?? uuid(),
    role: "SEEKER",
    status: (raw.status as Status) ?? "PENDING",
    firstName: raw.firstName ?? raw.name?.split(" ")[0] ?? "Seeker",
    lastName: raw.lastName ?? raw.name?.split(" ").slice(1).join(" ") ?? "User",
    companyName: raw.companyName ?? raw.companyDba ?? null,
    birthday: raw.birthday ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    zip: raw.zip ?? null,
    yearsInBusiness: raw.yearsInBusiness ?? null,
    deliveryVerticals: asArray(raw.deliveryVerticals),
    vehicle: raw.vehicle ?? null,
    insuranceType: raw.insuranceType ?? null,
    ref1: raw.ref1 ?? null,
    ref2: raw.ref2 ?? null,
    createdAt: raw.createdAt ?? now(),
  }));

  writeLS(KEY_SEEKERS, mapped, SEEKERS_SCHEMA_VERSION);
  removeStore(KEY_SEEKERS_OLD);
  return mapped;
}

function migrateLegacyRetainers(): Retainer[] | null {
  const legacy = readLS<any[]>(KEY_RETAINERS_OLD);
  if (!legacy || !Array.isArray(legacy)) return null;

  const mapped: Retainer[] = legacy.map((raw) => ({
    id: raw.id ?? uuid(),
    role: "RETAINER",
    status: (raw.status as Status) ?? "PENDING",
    companyName: raw.companyName ?? "Retainer",
    ceoName: raw.ceoName ?? raw.name ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    zip: raw.zip ?? null,
    mission: raw.mission ?? raw.notes ?? null,
    deliveryVerticals: asArray(raw.deliveryVerticals),
    employees: raw.employees ?? null,
    yearsInBusiness: raw.yearsInBusiness ?? null,
    desiredTraits: asArray(raw.desiredTraits),
    paymentTerms: raw.paymentTerms ?? null,
    feeSchedule: Array.isArray(raw.feeSchedule) ? raw.feeSchedule : null,
    createdAt: raw.createdAt ?? now(),
  }));

  writeLS(KEY_RETAINERS, mapped, RETAINERS_SCHEMA_VERSION);
  removeStore(KEY_RETAINERS_OLD);
  return mapped;
}

// === Simple subscription mechanism =========================================

type Snapshot = { seekers: Seeker[]; retainers: Retainer[] };
type Subscriber = (snapshot: Snapshot) => void;

let subscribers: Subscriber[] = [];

function notifySubscribers() {
  const snapshot: Snapshot = {
    seekers: getSeekers(),
    retainers: getRetainers(),
  };
  for (const fn of subscribers) {
    try {
      fn(snapshot);
    } catch {
      // ignore subscriber errors
    }
  }
}

/**
 * Subscribe to changes in seekers/retainers.
 * Returns an unsubscribe function.
 */
export function subscribe(listener: Subscriber): () => void {
  subscribers.push(listener);
  // fire initial snapshot
  try {
    listener({ seekers: getSeekers(), retainers: getRetainers() });
  } catch {
    // ignore
  }
  return () => {
    subscribers = subscribers.filter((fn) => fn !== listener);
  };
}

// === Core getters ===========================================================

export function getSeekers(): Seeker[] {
  const stored =
    readLS<Seeker[]>(KEY_SEEKERS) ??
    migrateLegacySeekers() ??
    [];

  return stored.map((s) => ({
    ...s,
    role: "SEEKER",
    status: s.status ?? "PENDING",
    createdAt: s.createdAt ?? now(),
    availability: normalizeAvailability((s as any).availability),
    subcontractors: normalizeSubcontractors((s as any).subcontractors, s.id),
    hierarchyNodes: normalizeHierarchyNodes((s as any).hierarchyNodes),
  }));
}

export function getRetainers(): Retainer[] {
  const stored =
    readLS<Retainer[]>(KEY_RETAINERS) ??
    migrateLegacyRetainers() ??
    [];

  return stored.map((r) => ({
    ...r,
    role: "RETAINER",
    status: r.status ?? "PENDING",
    createdAt: r.createdAt ?? now(),
    users: normalizeRetainerUsers((r as any).users, r.id),
    userLevelLabels: (r as any).userLevelLabels ?? DEFAULT_RETAINER_LEVEL_LABELS,
    hierarchyNodes: normalizeHierarchyNodes((r as any).hierarchyNodes),
  }));
}

// Detail lookups

export function getSeekerById(id: string): Seeker | undefined {
  return getSeekers().find((s) => s.id === id);
}

export function getRetainerById(id: string): Retainer | undefined {
  return getRetainers().find((r) => r.id === id);
}

// Internal save helpers

function saveSeekers(next: Seeker[]) {
  writeLS(KEY_SEEKERS, next, SEEKERS_SCHEMA_VERSION);
}

function saveRetainers(next: Retainer[]) {
  writeLS(KEY_RETAINERS, next, RETAINERS_SCHEMA_VERSION);
}

// === Status update helpers ==================================================

export function setSeekerStatus(id: string, status: Status) {
  const all = getSeekers();
  const next = all.map((s) =>
    s.id === id ? { ...s, status } : s
  );
  saveSeekers(next);
  notifySubscribers();

  // Linking safety: if a profile is deleted/rejected, auto-break any links.
  if (status === "DELETED" || status === "REJECTED") {
    const affected = disableLinksForSeeker(id);
    const seeker = next.find((s) => s.id === id);
    const seekerName = seeker
      ? [seeker.firstName, seeker.lastName].filter(Boolean).join(" ") || "Seeker"
      : "Seeker";

    for (const link of affected) {
      const retainer = getRetainers().find((r) => r.id === link.retainerId);
      const retainerName = retainer?.companyName || "Retainer";
      try {
        createConversationWithFirstMessage({
          seekerId: link.seekerId,
          retainerId: link.retainerId,
          subject: "Link update: Connection disabled",
          body: `System notice: the link between ${seekerName} and ${retainerName} was disabled because ${seekerName} is now ${status}.`,
          senderRole: "ADMIN",
        });
      } catch {
        // ignore messaging failures
      }
    }
  }
}

export function setRetainerStatus(id: string, status: Status) {
  const all = getRetainers();
  const next = all.map((r) =>
    r.id === id ? { ...r, status } : r
  );
  saveRetainers(next);
  notifySubscribers();

  // Linking safety: if a profile is deleted/rejected, auto-break any links.
  if (status === "DELETED" || status === "REJECTED") {
    const affected = disableLinksForRetainer(id);
    const retainer = next.find((r) => r.id === id);
    const retainerName = retainer?.companyName || "Retainer";

    for (const link of affected) {
      const seeker = getSeekers().find((s) => s.id === link.seekerId);
      const seekerName = seeker
        ? [seeker.firstName, seeker.lastName].filter(Boolean).join(" ") || "Seeker"
        : "Seeker";
      try {
        createConversationWithFirstMessage({
          seekerId: link.seekerId,
          retainerId: link.retainerId,
          subject: "Link update: Connection disabled",
          body: `System notice: the link between ${seekerName} and ${retainerName} was disabled because ${retainerName} is now ${status}.`,
          senderRole: "ADMIN",
        });
      } catch {
        // ignore messaging failures
      }
    }
  }
}

// Guarded wrappers used by AdminPage, etc.

export function setSeekerStatusGuarded(id: string, status: Status) {
  setSeekerStatus(id, status);
}

export function setRetainerStatusGuarded(id: string, status: Status) {
  setRetainerStatus(id, status);
}

// === Add / update helpers ===================================================

export function addSeeker(input: Partial<Seeker>): Seeker {
  const all = getSeekers();
  const id = uuid();
  const seeker: Seeker = {
    id,
    role: "SEEKER",
    status: input.status ?? "PENDING",
    firstName: input.firstName ?? "New",
    lastName: input.lastName ?? "Seeker",
    companyName: input.companyName,
    birthday: input.birthday,
    city: input.city,
    state: input.state,
    zip: input.zip,
    yearsInBusiness: input.yearsInBusiness,
    deliveryVerticals: input.deliveryVerticals ?? [],
    vehicle: input.vehicle,
    insuranceType: input.insuranceType,
    ref1: input.ref1,
    ref2: input.ref2,
    createdAt: now(),
    subcontractors: normalizeSubcontractors((input as any).subcontractors, id),
    hierarchyNodes: normalizeHierarchyNodes((input as any).hierarchyNodes),
  };
  const next = [...all, seeker];
  saveSeekers(next);
  notifySubscribers();
  return seeker;
}

export function addRetainer(input: Partial<Retainer>): Retainer {
  const all = getRetainers();
  const id = uuid();
  const retainer: Retainer = {
    id,
    role: "RETAINER",
    status: input.status ?? "PENDING",
    companyName: input.companyName ?? "New Retainer",
    ceoName: input.ceoName,
    city: input.city,
    state: input.state,
    zip: input.zip,
    mission: input.mission,
    deliveryVerticals: input.deliveryVerticals ?? [],
    employees: input.employees,
    yearsInBusiness: input.yearsInBusiness,
    desiredTraits: input.desiredTraits ?? [],
    paymentTerms: input.paymentTerms,
    feeSchedule: input.feeSchedule ?? [],
    createdAt: now(),
    users: normalizeRetainerUsers((input as any).users, id),
    userLevelLabels: (input as any).userLevelLabels ?? DEFAULT_RETAINER_LEVEL_LABELS,
    hierarchyNodes: normalizeHierarchyNodes((input as any).hierarchyNodes),
  };
  const next = [...all, retainer];
  saveRetainers(next);
  notifySubscribers();
  return retainer;
}

/** Wrapper: always creates a PENDING seeker */
export function addSeekerForcePending(input: Partial<Seeker>): Seeker {
  return addSeeker({ ...(input as any), status: "PENDING" } as any);
}

/** Wrapper: always creates a PENDING retainer */
export function addRetainerForcePending(input: Partial<Retainer>): Retainer {
  return addRetainer({ ...(input as any), status: "PENDING" } as any);
}

// === Retainer user helpers ================================================

export function getRetainerUsers(retainerId: string): RetainerUser[] {
  if (!retainerId) return [];
  const retainer = getRetainers().find((r) => r.id === retainerId);
  return retainer?.users ?? [];
}

export function setRetainerUserLevelLabels(
  retainerId: string,
  labels: RetainerUserLevelLabels
) {
  const all = getRetainers();
  const next = all.map((r) =>
    r.id === retainerId ? { ...r, userLevelLabels: { ...labels } } : r
  );
  saveRetainers(next);
  notifySubscribers();
}

export function addRetainerUser(
  retainerId: string,
  input: Partial<RetainerUser> & { level: RetainerUserLevel }
): RetainerUser | null {
  const all = getRetainers();
  const idx = all.findIndex((r) => r.id === retainerId);
  if (idx === -1) return null;

  const users = all[idx].users ?? [];
  if (!canRetainerAddUser(retainerId, users.length)) return null;

  const nextUser: RetainerUser = {
    id: uuid(),
    retainerId,
    firstName: input.firstName ?? "New",
    lastName: input.lastName ?? "User",
    title: input.title,
    email: input.email,
    phone: input.phone,
    photoUrl: input.photoUrl,
    bio: input.bio,
    level: input.level,
    createdAt: now(),
  };

  const updated: Retainer = {
    ...all[idx],
    users: [...users, nextUser],
  };

  const next = [...all];
  next[idx] = updated;
  saveRetainers(next);
  notifySubscribers();
  return nextUser;
}

export function removeRetainerUser(retainerId: string, userId: string) {
  const all = getRetainers();
  const idx = all.findIndex((r) => r.id === retainerId);
  if (idx === -1) return;

  const users = (all[idx].users ?? []).filter((u) => u.id !== userId);
  const hierarchyNodes = (all[idx].hierarchyNodes ?? [])
    .filter((n) => n.id !== userId)
    .map((n) =>
      n.parentId === userId ? { ...n, parentId: undefined } : n
    );

  const updated: Retainer = {
    ...all[idx],
    users,
    hierarchyNodes,
  };

  const next = [...all];
  next[idx] = updated;
  saveRetainers(next);
  notifySubscribers();
}

export function setRetainerHierarchyNodes(
  retainerId: string,
  nodes: HierarchyNode[]
) {
  const all = getRetainers();
  const idx = all.findIndex((r) => r.id === retainerId);
  if (idx === -1) return;

  const updated: Retainer = {
    ...all[idx],
    hierarchyNodes: normalizeHierarchyNodes(nodes),
  };

  const next = [...all];
  next[idx] = updated;
  saveRetainers(next);
  notifySubscribers();
}

export function getRetainerHierarchyNodes(retainerId: string): HierarchyNode[] {
  if (!retainerId) return [];
  return normalizeHierarchyNodes(
    (getRetainerById(retainerId) as any)?.hierarchyNodes
  );
}

// === Seeker subcontractor helpers =========================================

export function getSubcontractors(seekerId: string): Subcontractor[] {
  if (!seekerId) return [];
  const seeker = getSeekers().find((s) => s.id === seekerId);
  return seeker?.subcontractors ?? [];
}

export function addSubcontractor(
  seekerId: string,
  input: Partial<Subcontractor>
): Subcontractor | null {
  const all = getSeekers();
  const idx = all.findIndex((s) => s.id === seekerId);
  if (idx === -1) return null;

  const subs = all[idx].subcontractors ?? [];
  if (!canSeekerAddSubcontractor(seekerId, subs.length)) return null;

  const nextSub: Subcontractor = {
    id: uuid(),
    seekerId,
    firstName: input.firstName ?? "New",
    lastName: input.lastName ?? "Subcontractor",
    title: input.title,
    email: input.email,
    phone: input.phone,
    photoUrl: input.photoUrl,
    bio: input.bio,
    createdAt: now(),
  };

  const updated: Seeker = {
    ...all[idx],
    subcontractors: [...subs, nextSub],
  };

  const next = [...all];
  next[idx] = updated;
  saveSeekers(next);
  notifySubscribers();
  return nextSub;
}

export function removeSubcontractor(seekerId: string, subcontractorId: string) {
  const all = getSeekers();
  const idx = all.findIndex((s) => s.id === seekerId);
  if (idx === -1) return;

  const subs = (all[idx].subcontractors ?? []).filter(
    (s) => s.id !== subcontractorId
  );
  const hierarchyNodes = (all[idx].hierarchyNodes ?? [])
    .filter((n) => n.id !== subcontractorId)
    .map((n) =>
      n.parentId === subcontractorId ? { ...n, parentId: undefined } : n
    );

  const updated: Seeker = {
    ...all[idx],
    subcontractors: subs,
    hierarchyNodes,
  };

  const next = [...all];
  next[idx] = updated;
  saveSeekers(next);
  notifySubscribers();
}

export function setSeekerHierarchyNodes(
  seekerId: string,
  nodes: HierarchyNode[]
) {
  const all = getSeekers();
  const idx = all.findIndex((s) => s.id === seekerId);
  if (idx === -1) return;

  const updated: Seeker = {
    ...all[idx],
    hierarchyNodes: normalizeHierarchyNodes(nodes),
  };

  const next = [...all];
  next[idx] = updated;
  saveSeekers(next);
  notifySubscribers();
}

export function getSeekerHierarchyNodes(seekerId: string): HierarchyNode[] {
  if (!seekerId) return [];
  return normalizeHierarchyNodes(
    (getSeekerById(seekerId) as any)?.hierarchyNodes
  );
}

// === KPI helpers for Admin dashboard =======================================

export const kpiSeekers = {
  total: () => getSeekers().length,
  pending: () => getSeekers().filter((s) => s.status === "PENDING").length,
  approved: () => getSeekers().filter((s) => s.status === "APPROVED").length,
  rejected: () => getSeekers().filter((s) => s.status === "REJECTED").length,
  deleted: () => getSeekers().filter((s) => s.status === "DELETED").length,
  suspended: () => getSeekers().filter((s) => s.status === "SUSPENDED").length,
};

export const kpiRetainers = {
  total: () => getRetainers().length,
  pending: () => getRetainers().filter((r) => r.status === "PENDING").length,
  approved: () => getRetainers().filter((r) => r.status === "APPROVED").length,
  rejected: () => getRetainers().filter((r) => r.status === "REJECTED").length,
  deleted: () => getRetainers().filter((r) => r.status === "DELETED").length,
  suspended: () => getRetainers().filter((r) => r.status === "SUSPENDED").length,
};

// === Deleted-tab helpers ====================================================

export function getDeletedSeekers(): Seeker[] {
  return getSeekers().filter((s) => s.status === "DELETED");
}

export function getDeletedRetainers(): Retainer[] {
  return getRetainers().filter((r) => r.status === "DELETED");
}

export function restoreSeeker(id: string) {
  const existing = getSeekers().find((s) => s.id === id);
  if (!existing) return;
  setSeekerStatus(id, "PENDING");
}

// Alias used by detail page to restore to PENDING
export function restoreSeekerToPending(id: string) {
  setSeekerStatus(id, "PENDING");
}

// Soft delete = mark as DELETED (kept for Deleted tab)
export function softDeleteSeeker(id: string) {
  setSeekerStatus(id, "DELETED");
}

export function purgeSeeker(id: string) {
  const remaining = getSeekers().filter((s) => s.id !== id);
  saveSeekers(remaining);
  notifySubscribers();
}

export function restoreRetainer(id: string) {
  const existing = getRetainers().find((r) => r.id === id);
  if (!existing) return;
  setRetainerStatus(id, "PENDING");
}

// Alias used by detail page to restore to PENDING
export function restoreRetainerToPending(id: string) {
  setRetainerStatus(id, "PENDING");
}

// Soft delete = mark as DELETED (kept for Deleted tab)
export function softDeleteRetainer(id: string) {
  setRetainerStatus(id, "DELETED");
}

export function purgeRetainer(id: string) {
  const remaining = getRetainers().filter((r) => r.id !== id);
  saveRetainers(remaining);
  notifySubscribers();
}
