// src/lib/badges.ts
//
// Local-first badge system (global per profile, verified via linked relationships).
//
// Key ideas:
// - Badges are global per profile (Seeker/Retainer).
// - Only linked parties can verify badge check-ins.
// - "Working together" must be enabled on the link to submit check-ins.
// - Each profile can pick up to 4 active (goal) badges at a time.
// - Badges are scored as a lifetime average (YES/(YES+NO)).
// - A profile trust rating is derived from all badge confirmations (lifetime).
// - Badge levels are achieved based on lifetime average + sample size.
// - Levels never decrease once achieved; lifetime averages can change.

import { readStoreData, writeStore } from "./storage";
import { getActiveBadExitPenaltyPercent } from "./routeNotices";
import { getLink, getLinksForRetainer, getLinksForSeeker, isWorkingTogether, type Link } from "./linking";

export type BadgeOwnerRole = "SEEKER" | "RETAINER";
export type BadgeId = string;

export type BadgeKind = "BACKGROUND" | "SELECTABLE" | "SNAP" | "CHECKER";
export type BadgeCadence = "WEEKLY" | "MONTHLY" | "ONCE";
export type BadgeCheckinStatus = "ACTIVE" | "DISPUTED" | "OVERRIDDEN";

export type BadgeLevelRule = {
  minSamples: number;
  minPercent: number; // 0..100
};

export type BadgeDefinition = {
  id: BadgeId;
  ownerRole: BadgeOwnerRole;
  kind: BadgeKind;
  cadence?: BadgeCadence;
  weight?: number;
  title: string;
  iconKey: string;
  description: string;
  howToEarn: string;
  verifierRole: BadgeOwnerRole; // opposite party that verifies weekly
  weeklyPrompt: string;
};

export type BadgeProgress = {
  badgeId: BadgeId;
  ownerRole: BadgeOwnerRole;
  ownerId: string;
  yesCount: number;
  noCount: number;
  maxLevel: number; // 0..5 (never decreases)
  createdAt: string;
  updatedAt: string;
};

export type BadgeSelection = {
  ownerRole: BadgeOwnerRole;
  ownerId: string;
  activeBadgeIds: BadgeId[]; // SELECTABLE badges only
  backgroundBadgeIds: BadgeId[]; // BACKGROUND badges only
  backgroundLockedUntil?: string | null;
  updatedAt: string;
};

export type BadgeCheckinValue = "YES" | "NO";

export type BadgeCheckin = {
  id: string;
  weekKey: string; // period key (weekly YYYY-Www, monthly YYYY-MM)
  cadence?: BadgeCadence;

  // Link context (who worked with whom)
  seekerId: string;
  retainerId: string;

  badgeId: BadgeId;
  targetRole: BadgeOwnerRole;
  targetId: string;

  verifierRole: BadgeOwnerRole;
  verifierId: string;

  value: BadgeCheckinValue;
  status?: BadgeCheckinStatus;
  overrideValue?: BadgeCheckinValue;
  overrideNote?: string;
  createdAt: string;
  updatedAt: string;
};

type BadgeStore = {
  selections: BadgeSelection[];
  progress: BadgeProgress[];
  checkins: BadgeCheckin[];
};

export type BadgeRulesSnapshot = {
  roleDefaults: Record<BadgeOwnerRole, BadgeLevelRule[]>;
  badgeOverrides: Record<BadgeId, BadgeLevelRule[]>;
  updatedAt: string;
};

export type BadgeScoreSnapshot = {
  expectationsWeight: number;
  growthWeight: number;
  kindWeights: Record<BadgeKind, number>;
  badgeOverrides: Record<BadgeId, number>;
  levelMultipliers: number[];
  updatedAt: string;
};

const BADGES_KEY_V2 = "snapdriver_badges_v2";
const BADGES_KEY_V1 = "snapdriver_badges_v1";
const BADGE_RULES_KEY = "snapdriver_badge_rules_v1";
const BADGE_SCORE_KEY = "snapdriver_badge_scoring_v1";

const BADGES_SCHEMA_VERSION = 3;
const RULES_SCHEMA_VERSION = 1;
const SCORE_SCHEMA_VERSION = 1;

const DEFAULT_EXPECTATIONS_WEIGHT = 0.65;
const DEFAULT_GROWTH_WEIGHT = 0.35;
const DEFAULT_KIND_WEIGHTS: Record<BadgeKind, number> = {
  BACKGROUND: 3,
  SELECTABLE: 1,
  SNAP: 3,
  CHECKER: 3,
};
const DEFAULT_LEVEL_MULTIPLIERS = [1, 1.7, 2.5, 3.2, 4];
const BACKGROUND_LOCK_MONTHS = 12;
const TRUST_WINDOW_MONTHS = 12;

export const MAX_ACTIVE_BADGES = 4;
export const MAX_BACKGROUND_BADGES = 4;

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

function asInt(n: any, fallback: number) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.floor(v) : fallback;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  const v = Math.floor(n);
  return Math.max(min, Math.min(max, v));
}

function uniqStrings(arr: any[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const s = String(x);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function normalizeRole(raw: any): BadgeOwnerRole {
  return raw === "RETAINER" ? "RETAINER" : "SEEKER";
}

function isoWeekKey(d: Date = new Date()): string {
  // ISO week with Monday as first day; format: YYYY-Www
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  const ww = String(weekNo).padStart(2, "0");
  return `${date.getUTCFullYear()}-W${ww}`;
}

function monthKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function isWithinMonths(iso: string, months: number): boolean {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  const cutoff = addMonths(new Date(), -months);
  return ts >= cutoff.getTime();
}

function normalizeRulesArray(
  raw: any,
  fallback: BadgeLevelRule[]
): BadgeLevelRule[] {
  if (!Array.isArray(raw)) return fallback;
  const rules: BadgeLevelRule[] = raw.slice(0, 5).map((r) => ({
    minSamples: Math.max(0, asInt(r?.minSamples, 0)),
    minPercent: Math.max(
      0,
      Math.min(100, Number(r?.minPercent ?? 0) || 0)
    ),
  }));
  if (rules.length !== 5) return fallback;
  return rules;
}

function defaultRulesForRole(_role: BadgeOwnerRole): BadgeLevelRule[] {
  // Default rules are intentionally conservative; Admin can adjust.
  // NOTE: same defaults for now, but we keep per-role for future tuning.
  const base: BadgeLevelRule[] = [
    { minSamples: 4, minPercent: 80 },
    { minSamples: 12, minPercent: 85 },
    { minSamples: 24, minPercent: 90 },
    { minSamples: 52, minPercent: 92 },
    { minSamples: 78, minPercent: 95 },
  ];
  return base.map((x) => ({ ...x }));
}

function loadRulesSnapshot(): BadgeRulesSnapshot {
  const checkerRules: BadgeLevelRule[] = [
    { minSamples: 2, minPercent: 85 },
    { minSamples: 4, minPercent: 85 },
    { minSamples: 6, minPercent: 85 },
    { minSamples: 9, minPercent: 85 },
    { minSamples: 12, minPercent: 85 },
  ];
  const fallback: BadgeRulesSnapshot = {
    roleDefaults: {
      SEEKER: defaultRulesForRole("SEEKER"),
      RETAINER: defaultRulesForRole("RETAINER"),
    },
    badgeOverrides: {
      seeker_badge_checker: checkerRules.map((r) => ({ ...r })),
      retainer_badge_checker: checkerRules.map((r) => ({ ...r })),
    },
    updatedAt: nowIso(),
  };

  const raw = readStoreData<any>(BADGE_RULES_KEY);
  if (!raw || typeof raw !== "object") return fallback;

  const seekerDefaults = normalizeRulesArray(
    raw.roleDefaults?.SEEKER,
    fallback.roleDefaults.SEEKER
  );
  const retainerDefaults = normalizeRulesArray(
    raw.roleDefaults?.RETAINER,
    fallback.roleDefaults.RETAINER
  );

  const badgeOverrides: Record<BadgeId, BadgeLevelRule[]> = {};
  const overridesRaw = raw.badgeOverrides;
  if (overridesRaw && typeof overridesRaw === "object") {
    for (const [badgeId, rules] of Object.entries(overridesRaw)) {
      badgeOverrides[String(badgeId)] = normalizeRulesArray(rules, seekerDefaults);
    }
  }

  return {
    roleDefaults: { SEEKER: seekerDefaults, RETAINER: retainerDefaults },
    badgeOverrides,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function saveRulesSnapshot(snapshot: BadgeRulesSnapshot) {
  writeStore(BADGE_RULES_KEY, RULES_SCHEMA_VERSION, snapshot);
}

export function getBadgeRulesSnapshot(): BadgeRulesSnapshot {
  return loadRulesSnapshot();
}

export function getBadgeLevelRulesForRole(role: BadgeOwnerRole): BadgeLevelRule[] {
  const snap = loadRulesSnapshot();
  return snap.roleDefaults[role].map((x) => ({ ...x }));
}

export function setBadgeLevelRulesForRole(role: BadgeOwnerRole, rules: BadgeLevelRule[]): void {
  const snap = loadRulesSnapshot();
  snap.roleDefaults[role] = normalizeRulesArray(rules, defaultRulesForRole(role));
  snap.updatedAt = nowIso();
  saveRulesSnapshot(snap);
}

export function getBadgeLevelRulesForBadge(badgeId: BadgeId): BadgeLevelRule[] {
  const def = getBadgeDefinition(badgeId);
  if (!def) return defaultRulesForRole("SEEKER");
  const snap = loadRulesSnapshot();
  const override = snap.badgeOverrides[badgeId];
  if (override) return override.map((x) => ({ ...x }));
  return snap.roleDefaults[def.ownerRole].map((x) => ({ ...x }));
}

export function setBadgeLevelRulesForBadge(
  badgeId: BadgeId,
  rules: BadgeLevelRule[] | null
): void {
  const snap = loadRulesSnapshot();
  if (!rules) {
    delete snap.badgeOverrides[badgeId];
  } else {
    const def = getBadgeDefinition(badgeId);
    const fallback = def ? snap.roleDefaults[def.ownerRole] : defaultRulesForRole("SEEKER");
    snap.badgeOverrides[badgeId] = normalizeRulesArray(rules, fallback);
  }
  snap.updatedAt = nowIso();
  saveRulesSnapshot(snap);
}

function normalizeLevelMultipliers(raw: any, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback.slice();
  const cleaned = raw.slice(0, 5).map((v: any, idx: number) => {
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(num)) return fallback[idx] ?? 1;
    return Math.max(0.1, num);
  });
  if (cleaned.length != 5) return fallback.slice();
  return cleaned;
}

function normalizeKindWeights(raw: any): Record<BadgeKind, number> {
  const base: Record<BadgeKind, number> = { ...DEFAULT_KIND_WEIGHTS };
  if (!raw || typeof raw !== "object") return base;
  (Object.keys(base) as BadgeKind[]).forEach((kind) => {
    const num = Number((raw as any)[kind]);
    if (Number.isFinite(num) && num > 0) base[kind] = num;
  });
  return base;
}

function normalizeScoreWeights(expectationsWeight: any, growthWeight: any) {
  const exp = Number(expectationsWeight);
  const grow = Number(growthWeight);
  if (!Number.isFinite(exp) || !Number.isFinite(grow) || exp < 0 || grow < 0) {
    return { expectationsWeight: DEFAULT_EXPECTATIONS_WEIGHT, growthWeight: DEFAULT_GROWTH_WEIGHT };
  }
  const sum = exp + grow;
  if (sum <= 0) {
    return { expectationsWeight: DEFAULT_EXPECTATIONS_WEIGHT, growthWeight: DEFAULT_GROWTH_WEIGHT };
  }
  return { expectationsWeight: exp / sum, growthWeight: grow / sum };
}

function normalizeScoreSnapshot(raw: BadgeScoreSnapshot): BadgeScoreSnapshot {
  const weights = normalizeScoreWeights(raw.expectationsWeight, raw.growthWeight);
  const kindWeights = normalizeKindWeights(raw.kindWeights);
  const levelMultipliers = normalizeLevelMultipliers(raw.levelMultipliers, DEFAULT_LEVEL_MULTIPLIERS);
  const badgeOverrides: Record<BadgeId, number> = {};
  if (raw.badgeOverrides && typeof raw.badgeOverrides === "object") {
    for (const [badgeId, weight] of Object.entries(raw.badgeOverrides)) {
      const num = Number(weight);
      if (Number.isFinite(num) && num > 0) badgeOverrides[String(badgeId)] = num;
    }
  }
  return {
    expectationsWeight: weights.expectationsWeight,
    growthWeight: weights.growthWeight,
    kindWeights,
    badgeOverrides,
    levelMultipliers,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function loadScoreSnapshot(): BadgeScoreSnapshot {
  const fallback: BadgeScoreSnapshot = {
    expectationsWeight: DEFAULT_EXPECTATIONS_WEIGHT,
    growthWeight: DEFAULT_GROWTH_WEIGHT,
    kindWeights: { ...DEFAULT_KIND_WEIGHTS },
    badgeOverrides: {},
    levelMultipliers: DEFAULT_LEVEL_MULTIPLIERS.slice(),
    updatedAt: nowIso(),
  };

  const raw = readStoreData<any>(BADGE_SCORE_KEY);
  if (!raw || typeof raw !== "object") return fallback;
  return normalizeScoreSnapshot({ ...fallback, ...raw });
}

function saveScoreSnapshot(snapshot: BadgeScoreSnapshot) {
  writeStore(BADGE_SCORE_KEY, SCORE_SCHEMA_VERSION, snapshot);
}

export function getBadgeScoreSnapshot(): BadgeScoreSnapshot {
  return loadScoreSnapshot();
}

export function setBadgeScoreSnapshot(next: BadgeScoreSnapshot): void {
  const normalized = normalizeScoreSnapshot(next);
  saveScoreSnapshot(normalized);
}

export function setBadgeWeightOverride(badgeId: BadgeId, weight: number | null): void {
  const snap = loadScoreSnapshot();
  if (!weight || !Number.isFinite(weight) || weight <= 0) {
    delete snap.badgeOverrides[badgeId];
  } else {
    snap.badgeOverrides[badgeId] = weight;
  }
  snap.updatedAt = nowIso();
  saveScoreSnapshot(snap);
}

export function setBadgeKindWeight(kind: BadgeKind, weight: number): void {
  const snap = loadScoreSnapshot();
  if (!Number.isFinite(weight) || weight <= 0) return;
  snap.kindWeights[kind] = weight;
  snap.updatedAt = nowIso();
  saveScoreSnapshot(snap);
}

export function setBadgeScoreSplit(expectationsWeight: number, growthWeight: number): void {
  const snap = loadScoreSnapshot();
  const normalized = normalizeScoreSnapshot({
    ...snap,
    expectationsWeight,
    growthWeight,
  });
  saveScoreSnapshot(normalized);
}

export function setBadgeLevelMultipliers(next: number[]): void {
  const snap = loadScoreSnapshot();
  snap.levelMultipliers = normalizeLevelMultipliers(next, DEFAULT_LEVEL_MULTIPLIERS);
  snap.updatedAt = nowIso();
  saveScoreSnapshot(snap);
}

export function getBadgeKindWeight(kind: BadgeKind): number {
  const snap = loadScoreSnapshot();
  return snap.kindWeights[kind] ?? 1;
}

export function getBadgeLevelMultipliers(): number[] {
  const snap = loadScoreSnapshot();
  return snap.levelMultipliers.slice();
}

export function getBadgeScoreSplit(): { expectationsWeight: number; growthWeight: number } {
  const snap = loadScoreSnapshot();
  return { expectationsWeight: snap.expectationsWeight, growthWeight: snap.growthWeight };
}

export function getBadgeWeight(badgeId: BadgeId): number {
  const snap = loadScoreSnapshot();
  const override = snap.badgeOverrides[badgeId];
  if (Number.isFinite(override) && override > 0) return override as number;
  const def = getBadgeDefinition(badgeId);
  if (def && Number.isFinite(def.weight)) return Math.max(0.1, def.weight as number);
  if (def?.kind == "SELECTABLE") return 1;
  return 2;
}


function normalizeSelection(raw: any): BadgeSelection | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.ownerRole || !raw.ownerId) return null;
  const ownerRole = normalizeRole(raw.ownerRole);
  const ownerId = String(raw.ownerId);
  const activeBadgeIds = Array.isArray(raw.activeBadgeIds) ? uniqStrings(raw.activeBadgeIds) : [];
  const backgroundBadgeIds = Array.isArray(raw.backgroundBadgeIds)
    ? uniqStrings(raw.backgroundBadgeIds)
    : [];
  const validBackground = new Set(getBackgroundBadges(ownerRole).map((b) => b.id));
  const cleanedBackground = backgroundBadgeIds
    .filter((id) => validBackground.has(id))
    .slice(0, MAX_BACKGROUND_BADGES);
  const fallbackBackground =
    cleanedBackground.length > 0
      ? cleanedBackground
      : getBackgroundBadges(ownerRole)
          .map((b) => b.id)
          .slice(0, MAX_BACKGROUND_BADGES);
  return {
    ownerRole,
    ownerId,
    activeBadgeIds: activeBadgeIds.slice(0, MAX_ACTIVE_BADGES),
    backgroundBadgeIds: fallbackBackground,
    backgroundLockedUntil:
      typeof raw.backgroundLockedUntil === "string" ? raw.backgroundLockedUntil : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function normalizeProgress(raw: any): BadgeProgress | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.badgeId || !raw.ownerRole || !raw.ownerId) return null;
  const ownerRole = normalizeRole(raw.ownerRole);
  const badgeId = String(raw.badgeId);
  const ownerId = String(raw.ownerId);

  // Migration support: legacy used "points" as a counter.
  const legacyPoints = raw.points != null ? Math.max(0, asInt(raw.points, 0)) : null;
  const yesCount = Math.max(0, asInt(raw.yesCount, legacyPoints ?? 0));
  const noCount = Math.max(0, asInt(raw.noCount, 0));

  return {
    badgeId,
    ownerRole,
    ownerId,
    yesCount,
    noCount,
    maxLevel: clampInt(asInt(raw.maxLevel, 0), 0, 5),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function normalizeCheckin(raw: any): BadgeCheckin | null {
  if (!raw || typeof raw !== "object") return null;
  const weekKey = raw.weekKey ?? raw.periodKey;
  if (!weekKey || !raw.seekerId || !raw.retainerId) return null;
  if (!raw.badgeId || !raw.targetRole || !raw.targetId) return null;
  if (!raw.verifierRole || !raw.verifierId) return null;
  const targetRole = normalizeRole(raw.targetRole);
  const verifierRole = normalizeRole(raw.verifierRole);
  const value: BadgeCheckinValue = raw.value === "NO" ? "NO" : "YES";
  const cadence: BadgeCadence =
    raw.cadence === "MONTHLY" ? "MONTHLY" : raw.cadence === "ONCE" ? "ONCE" : "WEEKLY";
  const status: BadgeCheckinStatus =
    raw.status === "DISPUTED" ? "DISPUTED" : raw.status === "OVERRIDDEN" ? "OVERRIDDEN" : "ACTIVE";
  const overrideValue: BadgeCheckinValue | undefined =
    raw.overrideValue === "NO" ? "NO" : raw.overrideValue === "YES" ? "YES" : undefined;
  const overrideNote = typeof raw.overrideNote === "string" ? raw.overrideNote : undefined;
  return {
    id: String(raw.id || makeId("checkin")),
    weekKey: String(weekKey),
    cadence,
    seekerId: String(raw.seekerId),
    retainerId: String(raw.retainerId),
    badgeId: String(raw.badgeId),
    targetRole,
    targetId: String(raw.targetId),
    verifierRole,
    verifierId: String(raw.verifierId),
    value,
    status,
    overrideValue,
    overrideNote,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function normalizeStore(raw: any): BadgeStore {
  const selections = Array.isArray(raw?.selections)
    ? (raw.selections as any[]).map(normalizeSelection).filter(Boolean)
    : [];
  const progress = Array.isArray(raw?.progress)
    ? (raw.progress as any[]).map(normalizeProgress).filter(Boolean)
    : [];
  const checkins = Array.isArray(raw?.checkins)
    ? (raw.checkins as any[]).map(normalizeCheckin).filter(Boolean)
    : [];
  return {
    selections: selections as BadgeSelection[],
    progress: progress as BadgeProgress[],
    checkins: checkins as BadgeCheckin[],
  };
}

function getEffectiveCheckinValue(checkin: BadgeCheckin): BadgeCheckinValue | null {
  if (checkin.status === "DISPUTED") return null;
  if (checkin.overrideValue) return checkin.overrideValue;
  return checkin.value;
}

function computeCountsFromCheckins(
  checkins: BadgeCheckin[]
): Map<string, { yes: number; no: number }> {
  const map = new Map<string, { yes: number; no: number }>();
  for (const c of checkins) {
    const value = getEffectiveCheckinValue(c);
    if (!value) continue;
    const key = `${c.targetRole}:${c.targetId}:${c.badgeId}`;
    const curr = map.get(key) ?? { yes: 0, no: 0 };
    if (value === "YES") curr.yes += 1;
    else curr.no += 1;
    map.set(key, curr);
  }
  return map;
}

function computeTrustPercent(yesCount: number, noCount: number): number | null {
  const total = yesCount + noCount;
  if (total <= 0) return null;
  return Math.round((yesCount / total) * 100);
}

function computeLevelFromCounts(
  rules: BadgeLevelRule[],
  yesCount: number,
  noCount: number
): number {
  const total = yesCount + noCount;
  if (total <= 0) return 0;
  const percent = (yesCount / total) * 100;
  let level = 0;
  for (let i = 1; i <= 5; i++) {
    const r = rules[i - 1];
    if (total >= r.minSamples && percent >= r.minPercent) level = i;
  }
  return level;
}

function migrateFromV1(rawV1: any): BadgeStore {
  const v1 = normalizeStore(rawV1);
  const byCheckins = computeCountsFromCheckins(v1.checkins);
  const mergedProgress = new Map<string, BadgeProgress>();
  const ts = nowIso();

  for (const [key, counts] of byCheckins.entries()) {
    const [ownerRole, ownerId, badgeId] = key.split(":");
    mergedProgress.set(key, {
      badgeId,
      ownerRole: normalizeRole(ownerRole),
      ownerId,
      yesCount: counts.yes,
      noCount: counts.no,
      maxLevel: 0,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  for (const p of v1.progress) {
    const key = `${p.ownerRole}:${p.ownerId}:${p.badgeId}`;
    const existing = mergedProgress.get(key);
    if (!existing) {
      mergedProgress.set(key, { ...p });
      continue;
    }
    mergedProgress.set(key, {
      ...existing,
      yesCount: existing.yesCount || p.yesCount,
      noCount: existing.noCount || p.noCount,
      maxLevel: Math.max(existing.maxLevel, p.maxLevel),
      createdAt: existing.createdAt || p.createdAt || ts,
      updatedAt: ts,
    });
  }

  for (const [key, p] of mergedProgress.entries()) {
    const computed = computeLevelFromCounts(
      getBadgeLevelRulesForBadge(p.badgeId),
      p.yesCount,
      p.noCount
    );
    mergedProgress.set(key, { ...p, maxLevel: Math.max(p.maxLevel, computed) });
  }

  return {
    selections: v1.selections,
    progress: Array.from(mergedProgress.values()),
    checkins: v1.checkins,
  };
}

function loadStore(): BadgeStore {
  const rawV2 = readStoreData<any>(BADGES_KEY_V2);
  if (rawV2 && typeof rawV2 === "object") return normalizeStore(rawV2);

  const rawV1 = readStoreData<any>(BADGES_KEY_V1);
  if (rawV1 && typeof rawV1 === "object") {
    const migrated = migrateFromV1(rawV1);
    writeStore(BADGES_KEY_V2, BADGES_SCHEMA_VERSION, migrated);
    return migrated;
  }

  return { selections: [], progress: [], checkins: [] };
}

function saveStore(store: BadgeStore) {
  writeStore(BADGES_KEY_V2, BADGES_SCHEMA_VERSION, store);
}

function getOrCreateProgress(
  store: BadgeStore,
  ownerRole: BadgeOwnerRole,
  ownerId: string,
  badgeId: BadgeId
): BadgeProgress {
  const existing =
    store.progress.find(
      (p) => p.ownerRole === ownerRole && p.ownerId === ownerId && p.badgeId === badgeId
    ) ?? null;
  if (existing) return existing;
  const ts = nowIso();
  const created: BadgeProgress = {
    badgeId,
    ownerRole,
    ownerId,
    yesCount: 0,
    noCount: 0,
    maxLevel: 0,
    createdAt: ts,
    updatedAt: ts,
  };
  store.progress.push(created);
  return created;
}

export function getBadgeDefinitions(role: BadgeOwnerRole): BadgeDefinition[] {
  return ALL_BADGES.filter((b) => b.ownerRole === role);
}

export function getSelectableBadges(role: BadgeOwnerRole): BadgeDefinition[] {
  return getBadgeDefinitions(role).filter((b) => b.kind === "SELECTABLE");
}

export function getBackgroundBadges(role: BadgeOwnerRole): BadgeDefinition[] {
  return getBadgeDefinitions(role).filter((b) => b.kind === "BACKGROUND");
}

export function getSnapBadges(role: BadgeOwnerRole): BadgeDefinition[] {
  return getBadgeDefinitions(role).filter((b) => b.kind === "SNAP");
}

export function getCheckerBadges(role: BadgeOwnerRole): BadgeDefinition[] {
  return getBadgeDefinitions(role).filter((b) => b.kind === "CHECKER");
}

export function getBadgeDefinition(badgeId: BadgeId): BadgeDefinition | null {
  return ALL_BADGES.find((b) => b.id === badgeId) ?? null;
}

export function getActiveBadges(ownerRole: BadgeOwnerRole, ownerId: string): BadgeId[] {
  if (!ownerId) return [];
  const store = loadStore();
  const sel =
    store.selections.find((s) => s.ownerRole === ownerRole && s.ownerId === ownerId) ?? null;
  const ids = sel?.activeBadgeIds ?? [];
  const selectableIds = new Set(getSelectableBadges(ownerRole).map((b) => b.id));
  return ids.filter((id) => selectableIds.has(id)).slice(0, MAX_ACTIVE_BADGES);
}

export function setActiveBadges(
  ownerRole: BadgeOwnerRole,
  ownerId: string,
  badgeIds: BadgeId[]
): BadgeSelection {
  const store = loadStore();
  const selectableIds = new Set(getSelectableBadges(ownerRole).map((b) => b.id));
  const cleaned = uniqStrings(Array.isArray(badgeIds) ? badgeIds : [])
    .filter((id) => selectableIds.has(id))
    .slice(0, MAX_ACTIVE_BADGES);

  const ts = nowIso();
  const existing =
    store.selections.find((s) => s.ownerRole === ownerRole && s.ownerId === ownerId) ?? null;
  const backgroundBadgeIds =
    existing?.backgroundBadgeIds?.length
      ? existing.backgroundBadgeIds
      : getBackgroundBadges(ownerRole)
          .map((b) => b.id)
          .slice(0, MAX_BACKGROUND_BADGES);
  const backgroundLockedUntil = existing?.backgroundLockedUntil ?? null;
  const next: BadgeSelection = {
    ownerRole,
    ownerId,
    activeBadgeIds: cleaned,
    backgroundBadgeIds,
    backgroundLockedUntil,
    updatedAt: ts,
  };

  const idx = store.selections.findIndex((s) => s.ownerRole === ownerRole && s.ownerId === ownerId);
  if (idx >= 0) store.selections[idx] = next;
  else store.selections.push(next);

  saveStore(store);
  return next;
}

export function getSelectedBackgroundBadges(ownerRole: BadgeOwnerRole, ownerId: string): BadgeId[] {
  const fallback = getBackgroundBadges(ownerRole)
    .map((b) => b.id)
    .slice(0, MAX_BACKGROUND_BADGES);
  if (!ownerId) return fallback;
  const store = loadStore();
  const sel =
    store.selections.find((s) => s.ownerRole === ownerRole && s.ownerId === ownerId) ?? null;
  const ids = sel?.backgroundBadgeIds ?? [];
  const validIds = new Set(getBackgroundBadges(ownerRole).map((b) => b.id));
  const cleaned = ids.filter((id) => validIds.has(id)).slice(0, MAX_BACKGROUND_BADGES);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function getBackgroundLockStatus(ownerRole: BadgeOwnerRole, ownerId: string): {
  lockedUntil: string | null;
  isLocked: boolean;
} {
  if (!ownerId) return { lockedUntil: null, isLocked: false };
  const store = loadStore();
  const sel =
    store.selections.find((s) => s.ownerRole === ownerRole && s.ownerId === ownerId) ?? null;
  const lockedUntil = sel?.backgroundLockedUntil ?? null;
  const isLocked = !!lockedUntil && Date.parse(lockedUntil) > Date.now();
  return { lockedUntil, isLocked };
}

function fillWithFallback(primary: string[], fallback: string[], limit: number): string[] {
  const out = primary.slice(0, limit);
  for (const id of fallback) {
    if (out.length >= limit) break;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function setBackgroundBadges(
  ownerRole: BadgeOwnerRole,
  ownerId: string,
  badgeIds: BadgeId[],
  options?: { allowOverride?: boolean }
): BadgeSelection {
  const store = loadStore();
  const existing =
    store.selections.find((s) => s.ownerRole === ownerRole && s.ownerId === ownerId) ?? null;
  const lockUntil = existing?.backgroundLockedUntil ?? null;
  if (lockUntil && Date.parse(lockUntil) > Date.now() && !options?.allowOverride) {
    return existing ?? {
      ownerRole,
      ownerId,
      activeBadgeIds: [],
      backgroundBadgeIds: getSelectedBackgroundBadges(ownerRole, ownerId),
      backgroundLockedUntil: lockUntil,
      updatedAt: nowIso(),
    };
  }

  const validIds = new Set(getBackgroundBadges(ownerRole).map((b) => b.id));
  const cleaned = uniqStrings(Array.isArray(badgeIds) ? badgeIds : [])
    .filter((id) => validIds.has(id));
  const fallback = existing?.backgroundBadgeIds?.length
    ? existing.backgroundBadgeIds
    : getBackgroundBadges(ownerRole)
        .map((b) => b.id)
        .slice(0, MAX_BACKGROUND_BADGES);
  const filled = fillWithFallback(cleaned, fallback, MAX_BACKGROUND_BADGES);

  const ts = nowIso();
  const next: BadgeSelection = {
    ownerRole,
    ownerId,
    activeBadgeIds: existing?.activeBadgeIds ?? [],
    backgroundBadgeIds: filled,
    backgroundLockedUntil: addMonths(new Date(), BACKGROUND_LOCK_MONTHS).toISOString(),
    updatedAt: ts,
  };

  const idx = store.selections.findIndex((s) => s.ownerRole === ownerRole && s.ownerId === ownerId);
  if (idx >= 0) store.selections[idx] = next;
  else store.selections.push(next);
  saveStore(store);
  return next;
}

export function grantSnapBadge(
  ownerRole: BadgeOwnerRole,
  ownerId: string,
  badgeId: BadgeId
): BadgeProgress {
  const def = getBadgeDefinition(badgeId);
  if (!def || def.kind !== "SNAP") throw new Error("Snap badge not found.");
  const store = loadStore();
  const progress = getOrCreateProgress(store, ownerRole, ownerId, badgeId);
  if (progress.maxLevel >= 1) return progress;
  const ts = nowIso();
  const next: BadgeProgress = {
    ...progress,
    yesCount: Math.max(1, progress.yesCount),
    noCount: progress.noCount,
    maxLevel: Math.max(progress.maxLevel, 1),
    updatedAt: ts,
  };
  const idx = store.progress.findIndex(
    (p) => p.ownerRole === ownerRole && p.ownerId === ownerId && p.badgeId === badgeId
  );
  if (idx >= 0) store.progress[idx] = next;
  else store.progress.push(next);
  saveStore(store);
  return next;
}

export function getBadgeProgress(
  ownerRole: BadgeOwnerRole,
  ownerId: string,
  badgeId: BadgeId
): BadgeProgress {
  const store = loadStore();
  const existing =
    store.progress.find(
      (p) => p.ownerRole === ownerRole && p.ownerId === ownerId && p.badgeId === badgeId
    ) ?? null;
  if (existing) return existing;
  const ts = nowIso();
  return {
    badgeId,
    ownerRole,
    ownerId,
    yesCount: 0,
    noCount: 0,
    maxLevel: 0,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function computeBadgeProgressToNext(
  def: BadgeDefinition,
  progress: BadgeProgress
): {
  maxLevel: number;
  trustPercent: number | null;
  totalConfirmations: number;
  nextLevel: number | null;
  nextRule: BadgeLevelRule | null;
} {
  const trustPercent = computeTrustPercent(progress.yesCount, progress.noCount);
  const totalConfirmations = progress.yesCount + progress.noCount;
  if (progress.maxLevel >= 5) {
    return {
      maxLevel: 5,
      trustPercent,
      totalConfirmations,
      nextLevel: null,
      nextRule: null,
    };
  }
  const nextLevel = progress.maxLevel + 1;
  const rules = getBadgeLevelRulesForBadge(def.id);
  const nextRule = rules[nextLevel - 1] ?? null;
  return { maxLevel: progress.maxLevel, trustPercent, totalConfirmations, nextLevel, nextRule };
}

type BadgeTrustWindow = {
  percent: number | null;
  yes: number;
  no: number;
  total: number;
  linkCount: number;
};

function getBadgeTrustWindow(args: {
  ownerRole: BadgeOwnerRole;
  ownerId: string;
  badgeId: BadgeId;
  months?: number;
}): BadgeTrustWindow {
  const store = loadStore();
  const months = typeof args.months === "number" ? args.months : TRUST_WINDOW_MONTHS;
  const relevant = store.checkins.filter(
    (c) =>
      c.targetRole === args.ownerRole &&
      c.targetId === args.ownerId &&
      c.badgeId === args.badgeId &&
      isWithinMonths(c.createdAt, months)
  );

  let yes = 0;
  let no = 0;
  const perLink = new Map<string, { yes: number; no: number }>();
  for (const c of relevant) {
    const value = getEffectiveCheckinValue(c);
    if (!value) continue;
    const linkKey = args.ownerRole === "SEEKER" ? c.retainerId : c.seekerId;
    const curr = perLink.get(linkKey) ?? { yes: 0, no: 0 };
    if (value === "YES") {
      curr.yes += 1;
      yes += 1;
    } else {
      curr.no += 1;
      no += 1;
    }
    perLink.set(linkKey, curr);
  }

  const percents = Array.from(perLink.values())
    .map((counts) => computeTrustPercent(counts.yes, counts.no))
    .filter((p): p is number => p != null);

  const percent = percents.length
    ? Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length)
    : null;

  return { percent, yes, no, total: yes + no, linkCount: percents.length };
}

function getLevelMultiplier(level: number, multipliers: number[]): number {
  const idx = Math.max(1, Math.min(5, Math.floor(level))) - 1;
  return multipliers[idx] ?? 1;
}

export function getTrustRatingForProfile(args: {
  ownerRole: BadgeOwnerRole;
  ownerId: string;
}): { percent: number | null; yes: number; no: number; total: number } {
  const ownerId = args.ownerId;
  if (!ownerId) return { percent: null, yes: 0, no: 0, total: 0 };

  const { expectationsWeight, growthWeight } = getBadgeScoreSplit();
  const levelMultipliers = getBadgeLevelMultipliers();

  const expectationIds = [
    ...getSelectedBackgroundBadges(args.ownerRole, ownerId),
    ...getSnapBadges(args.ownerRole).map((b) => b.id),
    ...getCheckerBadges(args.ownerRole).map((b) => b.id),
  ];
  const growthIds = getActiveBadges(args.ownerRole, ownerId);

  const scoreGroup = (ids: BadgeId[]) => {
    let weightedSum = 0;
    let weightTotal = 0;
    let yes = 0;
    let no = 0;
    const seen = new Set<BadgeId>();
    for (const badgeId of ids) {
      if (seen.has(badgeId)) continue;
      seen.add(badgeId);
      const def = getBadgeDefinition(badgeId);
      if (!def) continue;
      let trust: BadgeTrustWindow | null = null;
      if (def.kind === "SNAP") {
        const p = getBadgeProgress(args.ownerRole, ownerId, badgeId);
        const percent = computeTrustPercent(p.yesCount, p.noCount);
        if (percent == null) continue;
        trust = { percent, yes: p.yesCount, no: p.noCount, total: p.yesCount + p.noCount, linkCount: 1 };
      } else {
        trust = getBadgeTrustWindow({
          ownerRole: args.ownerRole,
          ownerId,
          badgeId,
        });
        if (!trust || trust.percent == null) continue;
      }

      if (!trust || trust.percent == null) continue;

      const progress = getBadgeProgress(args.ownerRole, ownerId, badgeId);
      const multiplier = getLevelMultiplier(Math.max(1, progress.maxLevel || 1), levelMultipliers);
      const weight = getBadgeWeight(badgeId) * getBadgeKindWeight(def.kind) * multiplier;
      weightedSum += trust.percent * weight;
      weightTotal += weight;
      yes += trust.yes;
      no += trust.no;
    }
    const score = weightTotal > 0 ? weightedSum / weightTotal : null;
    return { score, yes, no, weightTotal };
  };

  const expectations = scoreGroup(expectationIds);
  const growth = scoreGroup(growthIds);

  let totalYes = expectations.yes + growth.yes;
  let totalNo = expectations.no + growth.no;
  let percent: number | null = null;

  const parts: Array<{ score: number; weight: number }> = [];
  if (expectations.score != null) parts.push({ score: expectations.score, weight: expectationsWeight });
  if (growth.score != null) parts.push({ score: growth.score, weight: growthWeight });

  if (parts.length > 0) {
    const weightSum = parts.reduce((sum, p) => sum + p.weight, 0) || 1;
    const weightedScore = parts.reduce((sum, p) => sum + p.score * p.weight, 0);
    percent = Math.round(weightedScore / weightSum);
  }

  if (percent != null && args.ownerRole === "SEEKER") {
    const penalty = getActiveBadExitPenaltyPercent(ownerId);
    if (penalty > 0) {
      percent = Math.max(0, percent - penalty);
    }
  }

  return { percent, yes: totalYes, no: totalNo, total: totalYes + totalNo };
}

export function getCheckinForPeriod(args: {
  periodKey: string;
  cadence?: BadgeCadence;
  badgeId: BadgeId;
  targetRole: BadgeOwnerRole;
  targetId: string;
  verifierRole: BadgeOwnerRole;
  verifierId: string;
  seekerId: string;
  retainerId: string;
}): BadgeCheckin | null {
  const store = loadStore();
  const cadence = args.cadence ?? "WEEKLY";
  return (
    store.checkins.find(
      (c) =>
        c.weekKey === args.periodKey &&
        (c.cadence ?? "WEEKLY") === cadence &&
        c.badgeId === args.badgeId &&
        c.targetRole === args.targetRole &&
        c.targetId === args.targetId &&
        c.verifierRole === args.verifierRole &&
        c.verifierId === args.verifierId &&
        c.seekerId === args.seekerId &&
        c.retainerId === args.retainerId
    ) ?? null
  );
}

export function getCheckinForWeek(args: {
  weekKey: string;
  badgeId: BadgeId;
  targetRole: BadgeOwnerRole;
  targetId: string;
  verifierRole: BadgeOwnerRole;
  verifierId: string;
  seekerId: string;
  retainerId: string;
}): BadgeCheckin | null {
  return getCheckinForPeriod({
    periodKey: args.weekKey,
    cadence: "WEEKLY",
    badgeId: args.badgeId,
    targetRole: args.targetRole,
    targetId: args.targetId,
    verifierRole: args.verifierRole,
    verifierId: args.verifierId,
    seekerId: args.seekerId,
    retainerId: args.retainerId,
  });
}

export type SubmitWeeklyCheckinArgs = {
  badgeId: BadgeId;
  weekKey?: string;
  periodKey?: string;
  cadence?: BadgeCadence;
  value: BadgeCheckinValue;

  // TODO(badges): Require a reason when value is NO (retainer/seeker explanation).
  // TODO(badges): Add admin tooling to create/edit badge descriptions.
  // TODO(badges): Add automation defaults (auto-approve on deadline unless explicitly rejected).

  // Link context:
  seekerId: string;
  retainerId: string;

  // Who is being evaluated:
  targetRole: BadgeOwnerRole;
  targetId: string;

  // Who is submitting the check-in:
  verifierRole: BadgeOwnerRole;
  verifierId: string;
};

type SubmitWeeklyCheckinResult = {
  checkin: BadgeCheckin;
  progress: BadgeProgress;
  link: Link;
};

function applyCheckinToStore(
  store: BadgeStore,
  args: SubmitWeeklyCheckinArgs
): SubmitWeeklyCheckinResult {
  const def = getBadgeDefinition(args.badgeId);
  if (!def) throw new Error("Unknown badge.");
  if (def.ownerRole !== args.targetRole) throw new Error("Badge does not match target role.");
  if (def.verifierRole !== args.verifierRole) throw new Error("You cannot verify this badge.");

  const link = getLink(args.seekerId, args.retainerId);
  if (!link || link.status !== "ACTIVE") throw new Error("Badges require an active link.");
  if (!isWorkingTogether(link)) {
    throw new Error("Badges require 'working together' to be enabled by both parties.");
  }

  const cadence = args.cadence ?? def.cadence ?? "WEEKLY";
  const periodKey =
    args.periodKey ?? args.weekKey ?? (cadence === "MONTHLY" ? monthKey() : isoWeekKey());

  const existingIdx = store.checkins.findIndex(
    (c) =>
      c.weekKey === periodKey &&
      (c.cadence ?? "WEEKLY") === cadence &&
      c.badgeId === args.badgeId &&
      c.targetRole === args.targetRole &&
      c.targetId === args.targetId &&
      c.verifierRole === args.verifierRole &&
      c.verifierId === args.verifierId &&
      c.seekerId === args.seekerId &&
      c.retainerId === args.retainerId
  );

  const existing = existingIdx >= 0 ? store.checkins[existingIdx] : null;
  if (existing && existing.status && existing.status !== "ACTIVE") {
    const progress = getOrCreateProgress(store, args.targetRole, args.targetId, args.badgeId);
    return { checkin: existing, progress, link };
  }

  const ts = nowIso();
  const progress = getOrCreateProgress(store, args.targetRole, args.targetId, args.badgeId);
  const nextProgress: BadgeProgress = { ...progress, updatedAt: ts };

  const applyDelta = (value: BadgeCheckinValue, dir: 1 | -1) => {
    if (value === "YES") nextProgress.yesCount = Math.max(0, nextProgress.yesCount + dir);
    else nextProgress.noCount = Math.max(0, nextProgress.noCount + dir);
  };

  if (existing) applyDelta(existing.value, -1);
  applyDelta(args.value, 1);

  const computed = computeLevelFromCounts(
    getBadgeLevelRulesForBadge(def.id),
    nextProgress.yesCount,
    nextProgress.noCount
  );
  nextProgress.maxLevel = Math.max(nextProgress.maxLevel, computed);

  const nextCheckin: BadgeCheckin = existing
    ? {
        ...existing,
        weekKey: periodKey,
        cadence,
        value: args.value,
        updatedAt: ts,
      }
    : {
        id: makeId("checkin"),
        weekKey: periodKey,
        cadence,
        seekerId: args.seekerId,
        retainerId: args.retainerId,
        badgeId: args.badgeId,
        targetRole: args.targetRole,
        targetId: args.targetId,
        verifierRole: args.verifierRole,
        verifierId: args.verifierId,
        value: args.value,
        status: "ACTIVE",
        createdAt: ts,
        updatedAt: ts,
      };

  if (existingIdx >= 0) store.checkins[existingIdx] = nextCheckin;
  else store.checkins.push(nextCheckin);

  const pIdx = store.progress.findIndex(
    (p) =>
      p.ownerRole === args.targetRole &&
      p.ownerId === args.targetId &&
      p.badgeId === args.badgeId
  );
  if (pIdx >= 0) store.progress[pIdx] = nextProgress;
  else store.progress.push(nextProgress);

  return { checkin: nextCheckin, progress: nextProgress, link };
}

export function submitWeeklyCheckin(
  args: SubmitWeeklyCheckinArgs
): SubmitWeeklyCheckinResult {
  const store = loadStore();
  const result = applyCheckinToStore(store, args);
  saveStore(store);
  return result;
}

export function submitWeeklyCheckinsBatch(
  argsList: SubmitWeeklyCheckinArgs[]
): { applied: number; skipped: number } {
  if (!argsList.length) return { applied: 0, skipped: 0 };
  const store = loadStore();
  let applied = 0;
  let skipped = 0;
  for (const args of argsList) {
    try {
      applyCheckinToStore(store, args);
      applied += 1;
    } catch {
      skipped += 1;
    }
  }
  saveStore(store);
  return { applied, skipped };
}

export function getCurrentWeekKey(): string {
  return getCurrentPeriodKey("WEEKLY");
}

export function getCurrentMonthKey(): string {
  return monthKey();
}

export function getCurrentPeriodKey(cadence: BadgeCadence = "WEEKLY"): string {
  if (cadence === "MONTHLY") return monthKey();
  return isoWeekKey();
}


export type PendingBadgeApproval = {
  badgeId: BadgeId;
  targetRole: BadgeOwnerRole;
  targetId: string;
  verifierRole: BadgeOwnerRole;
  verifierId: string;
  seekerId: string;
  retainerId: string;
  cadence: BadgeCadence;
  periodKey: string;
  linkId: string;
};

export function getPendingBadgeApprovalsForProfile(args: {
  ownerRole: BadgeOwnerRole;
  ownerId: string;
}): { count: number; items: PendingBadgeApproval[] } {
  if (!args.ownerId) return { count: 0, items: [] };
  const verifierRole = args.ownerRole;
  const links =
    args.ownerRole === "SEEKER"
      ? getLinksForSeeker(args.ownerId)
      : getLinksForRetainer(args.ownerId);
  const activeLinks = links.filter((l) => l.status === "ACTIVE" && isWorkingTogether(l));
  const items: PendingBadgeApproval[] = [];

  for (const link of activeLinks) {
    const counterpartRole: BadgeOwnerRole =
      args.ownerRole === "SEEKER" ? "RETAINER" : "SEEKER";
    const counterpartId = args.ownerRole === "SEEKER" ? link.retainerId : link.seekerId;

    const backgroundIds = getSelectedBackgroundBadges(counterpartRole, counterpartId);
    const activeIds = getActiveBadges(counterpartRole, counterpartId);
    const checkerIds = getCheckerBadges(counterpartRole).map((b) => b.id);
    const verifyableIds = Array.from(new Set([...backgroundIds, ...activeIds, ...checkerIds]));

    for (const badgeId of verifyableIds) {
      const def = getBadgeDefinition(badgeId);
      if (!def) continue;
      if (def.verifierRole !== verifierRole) continue;
      if (def.cadence === "ONCE") continue;
      const cadence = def.cadence ?? "WEEKLY";
      const periodKey = getCurrentPeriodKey(cadence);
      const existing = getCheckinForPeriod({
        periodKey,
        cadence,
        badgeId,
        targetRole: counterpartRole,
        targetId: counterpartId,
        verifierRole,
        verifierId: args.ownerId,
        seekerId: link.seekerId,
        retainerId: link.retainerId,
      });
      if (existing) continue;
      items.push({
        badgeId,
        targetRole: counterpartRole,
        targetId: counterpartId,
        verifierRole,
        verifierId: args.ownerId,
        seekerId: link.seekerId,
        retainerId: link.retainerId,
        cadence,
        periodKey,
        linkId: link.id,
      });
    }
  }

  return { count: items.length, items };
}

export function getBadgeCheckins(): BadgeCheckin[] {
  const store = loadStore();
  return store.checkins.slice().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function recomputeProgressForBadge(store: BadgeStore, targetRole: BadgeOwnerRole, targetId: string, badgeId: BadgeId) {
  const relevant = store.checkins.filter(
    (c) => c.targetRole === targetRole && c.targetId === targetId && c.badgeId === badgeId
  );
  let yes = 0;
  let no = 0;
  for (const c of relevant) {
    const value = getEffectiveCheckinValue(c);
    if (!value) continue;
    if (value === "YES") yes += 1;
    else no += 1;
  }

  const progress = getOrCreateProgress(store, targetRole, targetId, badgeId);
  const computed = computeLevelFromCounts(getBadgeLevelRulesForBadge(badgeId), yes, no);
  const ts = nowIso();
  const next: BadgeProgress = {
    ...progress,
    yesCount: yes,
    noCount: no,
    maxLevel: Math.max(progress.maxLevel, computed),
    updatedAt: ts,
  };
  const idx = store.progress.findIndex(
    (p) => p.ownerRole === targetRole && p.ownerId === targetId && p.badgeId === badgeId
  );
  if (idx >= 0) store.progress[idx] = next;
  else store.progress.push(next);
}

export function updateBadgeCheckinStatus(args: {
  checkinId: string;
  status: BadgeCheckinStatus;
  overrideValue?: BadgeCheckinValue;
  overrideNote?: string;
}): BadgeCheckin | null {
  const store = loadStore();
  const idx = store.checkins.findIndex((c) => c.id === args.checkinId);
  if (idx < 0) return null;
  const existing = store.checkins[idx];
  const next: BadgeCheckin = {
    ...existing,
    status: args.status,
    overrideValue: args.overrideValue,
    overrideNote: args.overrideNote,
    updatedAt: nowIso(),
  };
  store.checkins[idx] = next;
  recomputeProgressForBadge(store, existing.targetRole, existing.targetId, existing.badgeId);
  saveStore(store);
  return next;
}

export function getBadgeSummaryForProfile(args: {
  ownerRole: BadgeOwnerRole;
  ownerId: string;
  max?: number;
}): Array<{ badge: BadgeDefinition; maxLevel: number; trustPercent: number | null; total: number }> {
  const defs = getBadgeDefinitions(args.ownerRole);
  const max = typeof args.max === "number" ? Math.max(1, Math.floor(args.max)) : 6;
  const earned = defs
    .map((b) => {
      const p = getBadgeProgress(args.ownerRole, args.ownerId, b.id);
      const trustPercent = computeTrustPercent(p.yesCount, p.noCount);
      return { badge: b, maxLevel: p.maxLevel, trustPercent, total: p.yesCount + p.noCount };
    })
    .filter((x) => x.maxLevel > 0)
    .sort(
      (a, b) =>
        b.maxLevel - a.maxLevel ||
        (b.trustPercent ?? -1) - (a.trustPercent ?? -1) ||
        b.total - a.total
    );

  return earned.slice(0, max);
}

// === Badge catalog ===========================================================

const SEEKER_BADGES: BadgeDefinition[] = [
  // Snap badges (onboarding)
  {
    id: "seeker_snap_lane",
    ownerRole: "SEEKER",
    kind: "SNAP",
    cadence: "ONCE",
    verifierRole: "RETAINER",
    iconKey: "spark",
    title: "I Know My Lane",
    description:
      "Completes onboarding video acknowledging independent contractor status.",
    howToEarn:
      "Submit the onboarding video confirming you operate as an independent business.",
    weeklyPrompt: "Onboarding video completed.",
    weight: 3,
  },
  {
    id: "seeker_badge_checker",
    ownerRole: "SEEKER",
    kind: "CHECKER",
    cadence: "MONTHLY",
    verifierRole: "RETAINER",
    iconKey: "check",
    title: "Badge Checker",
    description: "Keeps monthly badge confirmations on time.",
    howToEarn:
      "Retainers confirm monthly. Stay current on badge approvals and check-ins.",
    weeklyPrompt: "Badge approvals stayed current this month.",
    weight: 3,
  },

  // Background badges (minimum expectations)
  {
    id: "seeker_no_dropped_routes",
    ownerRole: "SEEKER",
    kind: "BACKGROUND",
    verifierRole: "RETAINER",
    iconKey: "route",
    title: "Route Reliability",
    description: "Keeps commitments once scheduled.",
    howToEarn:
      "Keep your scheduled routes and notify early when changes are unavoidable.",
    weeklyPrompt: "Routes stayed on track and changes were communicated early this week.",
    weight: 4,
  },
  {
    id: "seeker_safety_standard",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "shield",
    title: "Safety Standard",
    description: "Operates safely and follows route/site protocols.",
    howToEarn: "Follow safety expectations and communicate hazards promptly.",
    weeklyPrompt: "Maintained a safe operating standard this week.",
  },
  {
    id: "seeker_professional_baseline",
    ownerRole: "SEEKER",
    kind: "BACKGROUND",
    verifierRole: "RETAINER",
    iconKey: "clipboard",
    title: "Exception Reporting",
    description: "Flags issues early with actionable detail.",
    howToEarn:
      "Report exceptions early and include clear, usable details.",
    weeklyPrompt: "Exceptions were reported quickly and clearly this week (if any).",
    weight: 2,
  },
  {
    id: "seeker_solid_pavement",
    ownerRole: "SEEKER",
    kind: "BACKGROUND",
    verifierRole: "RETAINER",
    iconKey: "calendar",
    title: "Solid as the Pavement",
    description: "Stays consistent with a retainer over the long haul.",
    howToEarn:
      "Retainers confirm a steady, ongoing working relationship over time.",
    weeklyPrompt: "Maintained a steady relationship with a retainer this week.",
    weight: 2,
  },

  // Selectable badges (opt-in goals)
  {
    id: "seeker_night_routes",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "moon",
    title: "Night Route Reliability",
    description: "Consistency and reliability on night routes.",
    howToEarn:
      "Retainers confirm weekly. Maintain strong night-route reliability over time.",
    weeklyPrompt:
      "Completed night work reliably this week (no missed routes / incidents).",
  },
  {
    id: "seeker_quick_response",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "bolt",
    title: "Quick Response",
    description: "Maintains timely communication during availability windows.",
    howToEarn: "Retainers confirm weekly. Respond promptly and consistently.",
    weeklyPrompt:
      "Responded quickly to operational messages during stated availability.",
  },
  {
    id: "seeker_no_breakdowns",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "wrench",
    title: "No Breakdowns",
    description: "Operates consistently without causing route disruptions.",
    howToEarn:
      "Retainers confirm weekly. Maintain equipment readiness and operational stability.",
    weeklyPrompt: "No breakdown-related route failures this week.",
  },
  {
    id: "seeker_on_time",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "clock",
    title: "On-Time Execution",
    description: "Arrives and executes on schedule.",
    howToEarn:
      "Retainers confirm weekly. Maintain on-time pickup and delivery performance.",
    weeklyPrompt: "Met on-time pickup/drop expectations this week.",
  },
  {
    id: "seeker_professional",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "shield",
    title: "Professional Standard",
    description: "Maintains professionalism, appearance, and compliance.",
    howToEarn:
      "Retainers confirm weekly. Maintain professional standards consistently.",
    weeklyPrompt:
      "Maintained professional standard (appearance, conduct, compliance) this week.",
  },
  {
    id: "seeker_communication",
    ownerRole: "SEEKER",
    kind: "BACKGROUND",
    verifierRole: "RETAINER",
    iconKey: "chat",
    title: "Professional Communication",
    description: "Communicates clearly and proactively with dispatch and sites.",
    howToEarn:
      "Keep comms clear, timely, and actionable across the route.",
    weeklyPrompt: "Communication was clear and proactive this week.",
    weight: 3,
  },

  // Additional Seeker selectable badges (v1 expansion)
  {
    id: "seeker_schedule_consistency",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "calendar",
    title: "Schedule Consistency",
    description: "Keeps a stable schedule and communicates changes early.",
    howToEarn:
      "Retainers confirm weekly. Maintain reliable availability and proactive updates.",
    weeklyPrompt:
      "Schedule was consistent and changes were communicated early this week.",
  },
  {
    id: "seeker_route_accuracy",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "route",
    title: "Route Accuracy",
    description: "Completes routes correctly with minimal errors.",
    howToEarn:
      "Retainers confirm weekly. Maintain strong scan/completion accuracy.",
    weeklyPrompt:
      "Completed routes accurately this week (low error / exception rate).",
  },
  {
    id: "seeker_careful_handling",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "box",
    title: "Careful Handling",
    description: "Handles freight carefully and reduces damage claims.",
    howToEarn:
      "Retainers confirm weekly. Maintain a damage-free handling record.",
    weeklyPrompt: "Handled freight carefully this week (no damage issues).",
  },
  {
    id: "seeker_problem_solver",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "spark",
    title: "Problem Solver",
    description: "Resolves issues calmly and keeps routes moving.",
    howToEarn:
      "Retainers confirm weekly. Demonstrate strong decision-making under pressure.",
    weeklyPrompt: "Resolved route issues effectively this week (if any occurred).",
  },
  {
    id: "seeker_customer_service",
    ownerRole: "SEEKER",
    kind: "BACKGROUND",
    verifierRole: "RETAINER",
    iconKey: "smile",
    title: "Customer/Brand Professionalism",
    description: "Represents customer and brand expectations on every stop.",
    howToEarn:
      "Maintain professional conduct and brand standards on site.",
    weeklyPrompt: "Represented the customer and brand professionally this week.",
    weight: 3,
  },
  {
    id: "seeker_doc_ready",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "clipboard",
    title: "Documentation Ready",
    description: "Provides required documents promptly when requested.",
    howToEarn:
      "Retainers confirm weekly. Keep documentation current and accessible.",
    weeklyPrompt: "Provided requested documents quickly this week (if requested).",
  },
  {
    id: "seeker_incident_free",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "shield",
    title: "Incident-Free Week",
    description: "Completes work without safety or compliance incidents.",
    howToEarn:
      "Retainers confirm weekly. Keep an incident-free record over time.",
    weeklyPrompt: "No safety/compliance incidents occurred this week.",
  },
  {
    id: "seeker_fuel_efficiency",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "leaf",
    title: "Fuel Efficient",
    description: "Operates efficiently and avoids unnecessary miles.",
    howToEarn:
      "Retainers confirm weekly. Maintain efficient routing and driving habits.",
    weeklyPrompt: "Operated efficiently this week (minimal waste / unnecessary miles).",
  },
  {
    id: "seeker_team_player",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "users",
    title: "Team Player",
    description: "Coordinates well with dispatch and site teams.",
    howToEarn:
      "Retainers confirm weekly. Collaborate effectively with ops teams.",
    weeklyPrompt: "Worked well with dispatch/site teams this week.",
  },
  {
    id: "seeker_early_arrival",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "clock",
    title: "Early Arrival",
    description: "Arrives early and prepared for pickups.",
    howToEarn:
      "Retainers confirm weekly. Maintain early/ready arrival behavior when appropriate.",
    weeklyPrompt: "Arrived early and prepared for pickups this week.",
  },
  {
    id: "seeker_load_securement",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "lock",
    title: "Load Securement",
    description: "Secures loads properly and reduces in-transit issues.",
    howToEarn:
      "Retainers confirm weekly. Maintain strong securement practices.",
    weeklyPrompt: "Secured loads properly this week (no securement issues).",
  },
  {
    id: "seeker_detail_oriented",
    ownerRole: "SEEKER",
    kind: "SELECTABLE",
    verifierRole: "RETAINER",
    iconKey: "target",
    title: "Detail Oriented",
    description: "Pays attention to details and avoids repeated mistakes.",
    howToEarn:
      "Retainers confirm weekly. Maintain a low rework/repeat issue rate.",
    weeklyPrompt: "Attention to detail was strong this week (low repeat errors).",
  },
];

const RETAINER_BADGES: BadgeDefinition[] = [
  // Snap badges (onboarding)
  {
    id: "retainer_snap_lane",
    ownerRole: "RETAINER",
    kind: "SNAP",
    cadence: "ONCE",
    verifierRole: "SEEKER",
    iconKey: "spark",
    title: "I Know My Lane",
    description: "Completes onboarding video acknowledging broker role and work offers.",
    howToEarn:
      "Submit the onboarding video confirming you are a broker and offer work.",
    weeklyPrompt: "Onboarding video completed.",
    weight: 3,
  },
  {
    id: "retainer_badge_checker",
    ownerRole: "RETAINER",
    kind: "CHECKER",
    cadence: "MONTHLY",
    verifierRole: "SEEKER",
    iconKey: "check",
    title: "Badge Checker",
    description: "Keeps monthly badge confirmations on time.",
    howToEarn:
      "Seekers confirm monthly. Stay current on badge approvals and check-ins.",
    weeklyPrompt: "Badge approvals stayed current this month.",
    weight: 3,
  },

  // Background badges (minimum expectations)
  {
    id: "retainer_clear_terms",
    ownerRole: "RETAINER",
    kind: "BACKGROUND",
    verifierRole: "SEEKER",
    iconKey: "clipboard",
    title: "Clear Terms",
    description: "Sets clear expectations for pay, routes, and operations.",
    howToEarn:
      "Keep terms clear and consistent; update drivers promptly when things change.",
    weeklyPrompt: "Terms and expectations were clear this week.",
    weight: 3,
  },
  {
    id: "retainer_fast_support",
    ownerRole: "RETAINER",
    kind: "BACKGROUND",
    verifierRole: "SEEKER",
    iconKey: "lifebuoy",
    title: "Support Responsiveness",
    description: "Responds quickly when drivers need help.",
    howToEarn:
      "Maintain responsive support channels and escalation paths.",
    weeklyPrompt: "Support responses were timely this week.",
    weight: 2,
  },
  {
    id: "retainer_payment_baseline",
    ownerRole: "RETAINER",
    kind: "BACKGROUND",
    verifierRole: "SEEKER",
    iconKey: "cash",
    title: "Payment Reliability",
    description: "Meets payment expectations on schedule.",
    howToEarn:
      "Pay per agreed terms, communicate exceptions early, and reconcile issues promptly.",
    weeklyPrompt: "Payment expectations were met this week (if payment occurred).",
    weight: 4,
  },
  {
    id: "retainer_fair_chance",
    ownerRole: "RETAINER",
    kind: "BACKGROUND",
    verifierRole: "SEEKER",
    iconKey: "target",
    title: "Fair Chance",
    description: "Gives new seekers a real shot to ramp up on routes.",
    howToEarn:
      "Provide support, context, and patience while new seekers learn the route.",
    weeklyPrompt: "Gave new seekers a fair chance to ramp this week (if applicable).",
    weight: 3,
  },

  // Selectable badges (opt-in goals)
  {
    id: "retainer_on_time_payment",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "cash",
    title: "Payday Precision",
    description: "Pays on time according to agreed terms.",
    howToEarn:
      "Seekers confirm weekly (when a payment cycle occurs). Maintain on-time pay.",
    weeklyPrompt: "Payment was made on time per the agreed terms (if payment occurred).",
  },
  {
    id: "retainer_payment_accuracy",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "check",
    title: "Payment Accuracy",
    description: "Pays accurately and consistently.",
    howToEarn:
      "Seekers confirm weekly (when reconciling pay). Maintain accurate payments.",
    weeklyPrompt:
      "Payment was accurate (no reconciliation issues) this cycle (if payment occurred).",
  },
  {
    id: "retainer_route_consistency",
    ownerRole: "RETAINER",
    kind: "BACKGROUND",
    verifierRole: "SEEKER",
    iconKey: "route",
    title: "Route Consistency",
    description: "Provides consistent work and stable expectations.",
    howToEarn:
      "Maintain consistent work availability and expectations.",
    weeklyPrompt: "Work availability and expectations were consistent this week.",
    weight: 2,
  },
  {
    id: "retainer_clear_ops",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "clipboard",
    title: "Clear Playbook",
    description: "Provides clear instructions and routing expectations.",
    howToEarn:
      "Seekers confirm weekly. Provide clear, actionable ops communication.",
    weeklyPrompt: "Instructions and operational expectations were clear this week.",
  },
  {
    id: "retainer_driver_support",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "lifebuoy",
    title: "Driver Backstop",
    description: "Supports drivers when issues happen on route.",
    howToEarn:
      "Seekers confirm weekly. Provide strong support when issues occur.",
    weeklyPrompt: "Support was strong and responsive when issues occurred this week.",
  },
  {
    id: "retainer_fair_resolution",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "scales",
    title: "Fair Shake",
    description: "Handles disputes and edge cases fairly.",
    howToEarn:
      "Seekers confirm weekly. Maintain fair dispute handling (when applicable).",
    weeklyPrompt: "Disputes / exceptions were handled fairly this week (if applicable).",
  },

  // Additional Retainer selectable badges (v1 expansion)
  {
    id: "retainer_clear_schedule",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "calendar",
    title: "Schedule Lock",
    description: "Provides schedules early with minimal last-minute changes.",
    howToEarn:
      "Seekers confirm weekly. Maintain predictable scheduling practices.",
    weeklyPrompt:
      "Schedules were communicated early and changes were minimal this week.",
  },
  {
    id: "retainer_fast_dispatch",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "bolt",
    title: "Fast Dispatch",
    description: "Keeps dispatch responsive and unblocked.",
    howToEarn:
      "Seekers confirm weekly. Keep dispatch response times tight and reliable.",
    weeklyPrompt: "Dispatch responses were fast and helpful this week.",
  },
  {
    id: "retainer_training_ready",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "book",
    title: "Training Ready",
    description: "Provides clear onboarding and route guidance.",
    howToEarn:
      "Seekers confirm weekly. Provide consistent onboarding materials and support.",
    weeklyPrompt:
      "Onboarding/training materials were sufficient this week (if applicable).",
  },
  {
    id: "retainer_route_quality",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "star",
    title: "Route Quality",
    description: "Offers routes with clear expectations and manageable constraints.",
    howToEarn:
      "Seekers confirm weekly. Improve route definitions and realism over time.",
    weeklyPrompt: "Routes offered were well-defined and reasonable this week.",
  },
  {
    id: "retainer_equipment_support",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "wrench",
    title: "Equipment Support",
    description: "Helps coordinate equipment expectations and readiness.",
    howToEarn:
      "Seekers confirm weekly. Provide clear equipment standards and assistance when needed.",
    weeklyPrompt: "Equipment expectations/support were clear this week.",
  },
  {
    id: "retainer_safe_sites",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "shield",
    title: "Safe Sites",
    description: "Maintains safe pickup/drop environments and procedures.",
    howToEarn:
      "Seekers confirm weekly. Keep safety procedures consistent and enforced.",
    weeklyPrompt: "Pickup/drop environments and procedures were safe this week.",
  },
  {
    id: "retainer_issue_resolution_speed",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "spark",
    title: "Fast Issue Resolution",
    description: "Resolves problems quickly when they happen.",
    howToEarn:
      "Seekers confirm weekly. Close issues promptly with clear next steps.",
    weeklyPrompt: "Issues were resolved quickly this week (if any occurred).",
  },
  {
    id: "retainer_transparency",
    ownerRole: "RETAINER",
    kind: "BACKGROUND",
    verifierRole: "SEEKER",
    iconKey: "eye",
    title: "Transparency",
    description: "Communicates changes and constraints honestly and early.",
    howToEarn:
      "Maintain transparent communication on changes.",
    weeklyPrompt: "Communication was transparent and early this week.",
    weight: 2,
  },
  {
    id: "retainer_growth_opportunities",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "target",
    title: "Growth Opportunities",
    description: "Creates long-term opportunities and upward paths for drivers.",
    howToEarn:
      "Seekers confirm weekly. Provide growth paths and consistency over time.",
    weeklyPrompt: "Provided growth opportunities or clear next steps this week.",
  },
  {
    id: "retainer_respectful_ops",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "users",
    title: "Respectful Operations",
    description: "Treats drivers with respect and professionalism.",
    howToEarn:
      "Seekers confirm weekly. Maintain a respectful operations culture.",
    weeklyPrompt: "Operations interactions were respectful this week.",
  },
  {
    id: "retainer_clear_escalations",
    ownerRole: "RETAINER",
    kind: "BACKGROUND",
    verifierRole: "SEEKER",
    iconKey: "arrow",
    title: "Clear Escalations",
    description: "Provides a clear escalation path when blockers occur.",
    howToEarn:
      "Keep escalation paths clear and responsive.",
    weeklyPrompt: "Escalation path was clear and effective this week (if needed).",
    weight: 2,
  },
  {
    id: "retainer_consistent_feedback",
    ownerRole: "RETAINER",
    kind: "SELECTABLE",
    verifierRole: "SEEKER",
    iconKey: "chat",
    title: "Consistent Feedback",
    description: "Gives actionable feedback that helps drivers improve.",
    howToEarn:
      "Seekers confirm weekly. Provide feedback that is clear, fair, and consistent.",
    weeklyPrompt: "Feedback was actionable and consistent this week (if applicable).",
  },
];

const ALL_BADGES: BadgeDefinition[] = [...SEEKER_BADGES, ...RETAINER_BADGES];
