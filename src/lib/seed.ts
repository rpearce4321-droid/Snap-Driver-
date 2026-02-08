// src/lib/seed.ts

import { setSeedModeEnabled } from "./serverSync";

import {
  addRetainer,
  addSeeker,
  addSeekerForcePending,
  addRetainerForcePending,
  setRetainerHierarchyNodes,
  setSeekerHierarchyNodes,
  getRetainers,
  getSeekers,
  US_STATES,
  VERTICALS,
  INSURANCE_TYPES,
  TRAITS,
  PAY_CYCLE_FREQUENCIES,
} from "./data";
import {
  addMessageToConversation,
  createConversationWithFirstMessage,
} from "./messages";
import { addRetainerStaffMessage } from "./retainerStaffMessages";
import { addSubcontractorMessage } from "./subcontractorMessages";
import { getSeekerEntitlements, setRetainerTier, setSeekerTier } from "./entitlements";
import {
  requestLink,
  setLinkApproved,
  setLinkVideoConfirmed,
  setWorkingTogether,
} from "./linking";
import { createRetainerPost } from "./posts";
import { createRetainerBroadcast } from "./broadcasts";
import { deliverRetainerBroadcastToLinkedSeekers } from "./broadcastDelivery";
import { createRoute, toggleInterest } from "./routes";
import {
  getActiveBadges,
  getBackgroundBadges,
  getBadgeCheckins,
  getBadgeDefinition,
  getBadgeKindWeight,
  getBadgeLevelMultipliers,
  getBadgeProgress,
  getBadgeScoreSplit,
  getBadgeWeight,
  getCheckerBadges,
  getSelectableBadges,
  getSelectedBackgroundBadges,
  getSnapBadges,
  grantSnapBadge,
  setActiveBadges,
  setBackgroundBadges,
  submitWeeklyCheckinsBatch,
  addReputationScoreHistoryEntry,
  REPUTATION_PENALTY_K,
  REPUTATION_SCORE_MAX,
  REPUTATION_SCORE_MIN,
  REPUTATION_SCORE_WINDOW_DAYS,
  type SubmitWeeklyCheckinArgs,
} from "./badges";
import { DAYS } from "./schedule";
import type { DayOfWeek, WeeklyAvailability } from "./schedule";

type SeedOptions = {
  seekers?: number;
  retainers?: number;
  /**
   * If true, wipe existing demo data in localStorage
   * before seeding (v2 + v3 keys).
   */
  force?: boolean;
};

type ComprehensiveSeedOptions = {
  retainers?: number; // default 5
  seekers?: number; // default 5
  /**
   * Of the 30 retainers:
   * - 10 will have 25 users
   * - 10 will have 615 users
   * - remaining will have 1 user
   */
  retainersSmallTeams?: number; // default 10
  retainersLargeTeams?: number; // default 10
  /**
   * Of the 200 seekers, how many get subcontractors.
   */
  seekersWithSubcontractors?: number; // default 40
  /**
   * Count ranges.
   */
  smallTeamUserMin?: number; // default 2
  smallTeamUserMax?: number; // default 5
  largeTeamUserMin?: number; // default 6
  largeTeamUserMax?: number; // default 15
  subcontractorMin?: number; // default 1
  subcontractorMax?: number; // default 8
  /**
   * If true, wipes existing local demo data before seeding.
   */
  force?: boolean;
};

/* ===== Random data pools ===== */

const FIRST_NAMES = [
  "Jordan",
  "Taylor",
  "Alex",
  "Riley",
  "Casey",
  "Morgan",
  "Avery",
  "Parker",
  "Drew",
  "Quinn",
  "Skyler",
  "Reese",
  "Harper",
  "Logan",
  "Rowan",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Davis",
  "Miller",
  "Wilson",
  "Anderson",
  "Moore",
  "Taylor",
  "Thomas",
  "Jackson",
  "Lewis",
  "Walker",
  "Young",
  "Allen",
  "King",
];

const COMPANY_PREFIXES = [
  "Mojo",
  "Velocity",
  "Summit",
  "Atlas",
  "Pioneer",
  "Compass",
  "Prime",
  "Apex",
  "Blue Ridge",
  "Ironclad",
];

const COMPANY_SUFFIXES = [
  "Logistics",
  "Courier",
  "Transport",
  "Delivery",
  "Freight",
  "Express",
  "Distribution",
  "Supply Chain",
];

const COMPANY_DESCRIPTORS = [
  "North",
  "South",
  "East",
  "West",
  "Metro",
  "Coastal",
  "Rapid",
  "Summit",
  "Pioneer",
  "Union",
  "Liberty",
  "Evergreen",
  "Ironwood",
  "Crescent",
  "Heritage",
  "Frontier",
  "Canyon",
  "Harbor",
  "River",
  "Lakeside",
  "Hilltop",
  "Skyline",
  "Midtown",
  "Capital",
];

const CITY_NAMES = [
  "Jacksonville",
  "Orlando",
  "Tampa",
  "Miami",
  "Tallahassee",
  "Gainesville",
  "Sarasota",
  "Lakeland",
  "Ocala",
  "St. Petersburg",
];

export const JOB_TITLES = [
  "Owner",
  "General Manager",
  "Operations Manager",
  "Dispatch Lead",
  "Route Coordinator",
  "Fleet Manager",
  "HR Coordinator",
  "Safety Manager",
  "Account Manager",
  "Customer Success",
  "Recruiter",
  "Analyst",
  "Team Lead",
  "Supervisor",
];

export const SEEKER_AVAILABILITY = [
  "Weekdays (AM)",
  "Weekdays (PM)",
  "Weekdays (flex)",
  "Weekends",
  "Nights",
  "On-call / surge support",
  "Seasonal",
];

/* ===== Utility helpers ===== */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function pickSome<T>(arr: T[], min: number, max: number): T[] {
  if (arr.length === 0) return [];
  const count = Math.min(arr.length, randomInt(min, max));
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = randomInt(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function randomZip(): string {
  // Florida-ish range; not perfect, just "looks right"
  return String(randomInt(32003, 33994));
}

function randomDateOfBirth(): string {
  const year = randomInt(1970, 2000);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function randomPhone(): string {
  const area = randomInt(200, 989);
  const prefix = randomInt(200, 989);
  const line = randomInt(1000, 9999);
  return `(${area}) ${prefix}-${line}`;
}

function defaultTimezone(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
}

function randomWeeklyAvailability(): WeeklyAvailability {
  const templates: Array<{ days: DayOfWeek[]; start: string; end: string }> = [
    { days: ["MON", "TUE", "WED", "THU", "FRI"], start: "08:00", end: "16:00" },
    { days: ["MON", "TUE", "WED", "THU", "FRI"], start: "14:00", end: "22:00" },
    { days: ["MON", "TUE", "WED", "THU", "FRI"], start: "18:00", end: "23:00" },
    { days: ["SAT", "SUN"], start: "09:00", end: "15:00" },
  ];

  const t = pick(templates);
  const extraDays = pickSome<DayOfWeek>(
    ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    0,
    2
  );

  const daySet = new Set<DayOfWeek>([...t.days, ...extraDays]);
  const blocks = Array.from(daySet).map((day) => ({
    day,
    start: t.start,
    end: t.end,
  }));

  return { timezone: defaultTimezone(), blocks };
}

function randomRouteScheduleV2(): {
  scheduleDays: DayOfWeek[];
  scheduleStart: string;
  scheduleEnd: string;
  scheduleLabel: string;
} {
  const templates: Array<{
    days: DayOfWeek[];
    start: string;
    end: string;
    label: string;
  }> = [
    {
      days: ["MON", "TUE", "WED", "THU", "FRI"],
      start: "08:00",
      end: "16:00",
      label: "Weekdays (8am-4pm)",
    },
    {
      days: ["MON", "TUE", "WED", "THU", "FRI"],
      start: "14:00",
      end: "22:00",
      label: "Weekdays (2pm-10pm)",
    },
    {
      days: ["SAT", "SUN"],
      start: "09:00",
      end: "15:00",
      label: "Weekend coverage",
    },
    {
      days: ["MON", "TUE", "WED", "THU", "FRI"],
      start: "18:00",
      end: "23:00",
      label: "Night shift",
    },
  ];

  const t = pick(templates);
  return {
    scheduleDays: t.days,
    scheduleStart: t.start,
    scheduleEnd: t.end,
    scheduleLabel: t.label,
  };
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(^-+|-+$)/g, "");
}

/**
 * Seeker last names must contain "*" so we can easily identify test data.
 * e.g. "Smith*"
 */
function makeStarLastName(): string {
  return pick(LAST_NAMES) + "*";
}

/**
 * CEO names for retainers also get a "*" in the last name.
 * e.g. "Jordan Smith*"
 */
function makeStarCeoName(): string {
  const first = pick(FIRST_NAMES);
  const last = makeStarLastName(); // already includes "*"
  return `${first} ${last}`;
}

/**
 * Remove "*" from a last name when building emails.
 */
function stripStars(name: string): string {
  return name.replace(/\*/g, "");
}

function makeTempId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function hashToInt(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function isoWeekKeyForDate(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function buildHistoryDates(daysBack: number, stepOptions: number[]): Date[] {
  const now = new Date();
  const start = new Date(now.getTime());
  start.setDate(start.getDate() - daysBack);
  const dates: Date[] = [];
  let cursor = new Date(now.getTime());
  while (cursor >= start) {
    dates.push(new Date(cursor.getTime()));
    const step = pick(stepOptions);
    cursor.setDate(cursor.getDate() - step);
  }
  return dates.reverse();
}

function clampReputationScoreValue(score: number): number {
  return Math.max(
    REPUTATION_SCORE_MIN,
    Math.min(REPUTATION_SCORE_MAX, Math.round(score))
  );
}

function getSeedCheckinValue(checkin: any): "YES" | "NO" | null {
  if (!checkin) return null;
  if (checkin.status === "DISPUTED") return null;
  return checkin.overrideValue ?? checkin.value ?? null;
}

function isWithinDaysOf(iso: string, days: number, asOf: Date): boolean {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  const asOfTs = asOf.getTime();
  const cutoff = asOfTs - days * 86_400_000;
  return ts >= cutoff && ts <= asOfTs;
}

function getLevelMultiplierFor(level: number, multipliers: number[]): number {
  const idx = Math.max(1, Math.min(5, Math.floor(level))) - 1;
  return multipliers[idx] ?? 1;
}

function computeSeedReputationScoreFromCounts(
  yesCount: number,
  noCount: number,
  levelMultiplier: number
): number | null {
  const total = yesCount + noCount;
  if (total <= 0) return null;
  const yesRate = yesCount / total;
  const noRate = noCount / total;
  const baseScore =
    REPUTATION_SCORE_MIN +
    (REPUTATION_SCORE_MAX - REPUTATION_SCORE_MIN) * yesRate;
  const penalty = baseScore * REPUTATION_PENALTY_K * noRate * levelMultiplier;
  return clampReputationScoreValue(baseScore - penalty);
}

function computeSeedScoreForProfileAtDate(args: {
  ownerRole: "SEEKER" | "RETAINER";
  ownerId: string;
  asOf: Date;
  days?: number;
}): number | null {
  const ownerId = String(args.ownerId ?? "").trim();
  if (!ownerId) return null;
  const days = typeof args.days === "number" ? args.days : REPUTATION_SCORE_WINDOW_DAYS;
  const checkins = getBadgeCheckins();
  const levelMultipliers = getBadgeLevelMultipliers();
  const { expectationsWeight, growthWeight } = getBadgeScoreSplit();

  const expectationIds = [
    ...getSelectedBackgroundBadges(args.ownerRole, ownerId),
    ...getSnapBadges(args.ownerRole).map((b) => b.id),
    ...getCheckerBadges(args.ownerRole).map((b) => b.id),
  ];
  const growthIds = getActiveBadges(args.ownerRole, ownerId);

  const countsForBadge = (badgeId: string) => {
    let yes = 0;
    let no = 0;
    for (const c of checkins) {
      if (c.targetRole !== args.ownerRole) continue;
      if (c.targetId !== ownerId) continue;
      if (c.badgeId !== badgeId) continue;
      if (!isWithinDaysOf(c.createdAt, days, args.asOf)) continue;
      const value = getSeedCheckinValue(c);
      if (!value) continue;
      if (value === "YES") yes += 1;
      else no += 1;
    }
    return { yes, no, total: yes + no };
  };

  const scoreGroup = (ids: string[]) => {
    let weightedSum = 0;
    let weightTotal = 0;
    const seen = new Set<string>();
    for (const badgeId of ids) {
      if (seen.has(badgeId)) continue;
      seen.add(badgeId);
      const def = getBadgeDefinition(badgeId);
      if (!def) continue;

      const progress = getBadgeProgress(args.ownerRole, ownerId, badgeId);
      const levelMultiplier = getLevelMultiplierFor(
        Math.max(1, progress.maxLevel || 1),
        levelMultipliers
      );

      const counts =
        def.kind === "SNAP"
          ? {
              yes: progress.yesCount,
              no: progress.noCount,
              total: progress.yesCount + progress.noCount,
            }
          : countsForBadge(badgeId);

      if (counts.total <= 0) continue;

      const score = computeSeedReputationScoreFromCounts(
        counts.yes,
        counts.no,
        levelMultiplier
      );
      if (score == null) continue;

      const weight = getBadgeWeight(badgeId) * getBadgeKindWeight(def.kind);
      weightedSum += score * weight;
      weightTotal += weight;
    }

    const score = weightTotal > 0 ? weightedSum / weightTotal : null;
    return { score };
  };

  const expectations = scoreGroup(expectationIds);
  const growth = scoreGroup(growthIds);

  const parts: Array<{ score: number; weight: number }> = [];
  if (expectations.score != null) {
    parts.push({ score: expectations.score, weight: expectationsWeight });
  }
  if (growth.score != null) {
    parts.push({ score: growth.score, weight: growthWeight });
  }

  if (parts.length === 0) return null;
  const weightSum = parts.reduce((sum, p) => sum + p.weight, 0) || 1;
  const weightedScore = parts.reduce((sum, p) => sum + p.score * p.weight, 0);
  return clampReputationScoreValue(weightedScore / weightSum);
}

function buildYesThresholdSeries(count: number): number[] {
  if (count <= 0) return [];
  const base = randomInt(4, 7);
  const amp = randomInt(1, 3);
  const period = randomInt(4, 7);
  const phase = randomInt(0, Math.max(1, period - 1));
  const out: number[] = [];
  for (let idx = 0; idx < count; idx++) {
    const wave = Math.sin(((idx + phase) / period) * Math.PI * 2);
    const threshold = Math.round(base + wave * amp);
    out.push(Math.max(3, Math.min(9, threshold)));
  }
  return out;
}


function avatarDataUri(label: string, seed: string): string {
  const text = initials(label);
  const hue = hashToInt(seed) % 360;
  const bg = `hsl(${hue} 55% 38%)`;
  const fg = "rgba(255,255,255,0.95)";
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${text}">
  <rect width="256" height="256" rx="48" fill="${bg}"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
        font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial"
        font-size="96" font-weight="700" fill="${fg}">${text}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function placeholderImageDataUri(label: string, seed: string): string {
  const hue = (hashToInt(seed) + 120) % 360;
  const bg = `hsl(${hue} 40% 22%)`;
  const fg = "rgba(255,255,255,0.88)";
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="${label}">
  <rect width="1200" height="800" fill="${bg}"/>
  <rect x="60" y="60" width="1080" height="680" rx="36" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)" stroke-width="6"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
        font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial"
        font-size="52" font-weight="700" fill="${fg}">${label}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function uniqueValue(make: () => string, used: Set<string>): string {
  for (let i = 0; i < 200; i++) {
    const next = make();
    if (!used.has(next)) {
      used.add(next);
      return next;
    }
  }
  // Final fallback: deterministic suffix (no random strings)
  let n = 2;
  while (true) {
    const base = make();
    const candidate = `${base} ${n}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    n += 1;
  }
}

/* ===== LocalStorage wipe for demo data ===== */
const SCORE_HISTORY_KEY = "snapdriver_reputation_history_v1";


function wipeDemoLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return;

  const ls = window.localStorage;
  // Old + current demo keys - safe to nuke when seeding
  const KEYS = [
    "seekers",
    "retainers",
    "demo_seekers_v2",
    "demo_retainers_v2",
    "demo_seekers_v3",
    "demo_retainers_v3",
    "snapdriver_subcontractor_messages_v1",
    "snapdriver_retainer_staff_messages_v1",
    "snapdriver_entitlements_v1",
    "snapdriver_links_v1",
    "snapdriver_routes_v1",
    "snapdriver_route_interests_v1",
    "snapdriver_badges_v1",
    "snapdriver_badges_v2",
    "snapdriver_badge_rules_v1",
    "snapdriver_badge_scoring_v1",
    "snapdriver_reputation_history_v1",
  ];

  for (const key of KEYS) {
    try {
      ls.removeItem(key);
    } catch {
      // ignore
    }
  }
}


function clearSeedScoreHistory() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(SCORE_HISTORY_KEY, "[]");
  } catch {
    // ignore
  }
}

function wipeDemoLocalStorageComprehensive() {
  if (typeof window === "undefined" || !window.localStorage) return;
  const ls = window.localStorage;

  // First collect keys (don't mutate while iterating)
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (!k) continue;
    if (
      k === "seekers" ||
      k === "retainers" ||
      k.startsWith("demo_") ||
      k.startsWith("snapdriver_")
    ) {
      keys.push(k);
    }
  }

  for (const key of keys) {
    try {
      ls.removeItem(key);
    } catch {
      // ignore
    }
  }

  // Defensive: ensure core store keys are reset even if removeItem fails.
  try {
    ls.setItem("demo_seekers_v2", "[]");
    ls.setItem("demo_retainers_v2", "[]");
  } catch {
    // ignore
  }
}


export function wipeLocalDataComprehensive() {
  wipeDemoLocalStorageComprehensive();
}

/* ===== Main front-end seeder (localStorage) ===== */

/**
 * Front-end seeding for the localStorage-driven store.
 * This does NOT touch the Prisma/Postgres database.
 *
 * - Creates PENDING seekers & retainers.
 * - Adds random email + phone for both sides.
 * - Last names / CEO last names include "*" so they
 *   can be bulk-identified and deleted later.
 */
export function autoSeed(opts: SeedOptions = {}): void {
  // Defaults: 5 / 5 for small demo seeds
  const seekerCount = opts.seekers ?? 5;
  const retainerCount = opts.retainers ?? 5;

  if (opts.force) {
    wipeDemoLocalStorage();
  }

  const statePool = US_STATES.length ? US_STATES : ["FL"];
  const nowIso = new Date().toISOString();
  const historyDates = buildHistoryDates(180, [14]);

  /* ---- Seed Retainers (PENDING) ---- */

  for (let i = 0; i < retainerCount; i++) {
    const prefix = pick(COMPANY_PREFIXES);
    const suffix = pick(COMPANY_SUFFIXES);
    const companyName = `${prefix} ${suffix}`;
    const city = pick(CITY_NAMES);
    const state = pick(statePool);
    const zip = randomZip();

    const deliveryVerticals = pickSome(
      VERTICALS,
      1,
      Math.min(3, VERTICALS.length)
    );
    const desiredTraits = pickSome(
      TRAITS,
      2,
      Math.min(4, TRAITS.length)
    );

    const ceoName = makeStarCeoName();
    const [ceoFirst, ceoLastWithStar] = ceoName.split(" ");
    const ceoLast = stripStars(ceoLastWithStar || "");
    const companySlug = slugify(companyName || "retainerco");
    const ceoSlugFirst = slugify(ceoFirst || "ceo");
    const ceoSlugLast = slugify(ceoLast || "last");

    // Retainer-level contact email + phone
    const retainerEmail = `${ceoSlugFirst}.${ceoSlugLast}@${companySlug}.com`;
    const retainerPhone = randomPhone();

    const userLevelLabels = {
      level1: "Viewer",
      level2: "Manager",
      level3: "Owner",
    };

    const ownerFirst = ceoFirst || pick(FIRST_NAMES);
    const ownerLast = ceoLastWithStar || pick(LAST_NAMES);

      const users = [
        {
          id: makeTempId("ru"),
          firstName: ownerFirst,
          lastName: ownerLast,
          title: userLevelLabels.level3,
          bio: "Founder focused on long-term partnerships and growth.",
          level: 3,
          email: retainerEmail,
          phone: retainerPhone,
        },
        {
          id: makeTempId("ru"),
          firstName: pick(FIRST_NAMES),
          lastName: pick(LAST_NAMES),
          title: "Operations Manager",
          bio: "Oversees daily ops, staffing, and workflow efficiency.",
          level: 2,
          email: `ops@${companySlug}.com`,
        },
        {
          id: makeTempId("ru"),
          firstName: pick(FIRST_NAMES),
          lastName: pick(LAST_NAMES),
          title: "Coordinator",
          bio: "Supports route coverage and customer coordination.",
          level: 1,
        },
      ];

    const hierarchyNodes = [
      { id: users[0].id, x: 220, y: 40 },
      { id: users[1].id, x: 80, y: 160 },
      { id: users[2].id, x: 360, y: 160 },
    ];

    const payCycleCloseDay = pick(DAYS).key;
    const payCycleFrequency = pick(PAY_CYCLE_FREQUENCIES).value;

    addRetainerForcePending({
      companyName,
      ceoName,
      city,
      state,
      zip,
      mission:
        "We specialize in last-mile delivery with a focus on reliability, communication, and brand-safe customer experiences.",
      yearsInBusiness: randomInt(1, 20),
      employees: randomInt(5, 150),
      deliveryVerticals,
      desiredTraits,
      payCycleCloseDay,
      payCycleFrequency,
      payCycleTimezone: "EST",
      createdAt: nowIso,
      role: "RETAINER",
      status: "PENDING",
      // extra fields consumed by UI in some places
      email: retainerEmail,
      phone: retainerPhone,
      users,
      userLevelLabels,
      hierarchyNodes,
    } as any);
  }

  /* ---- Seed Seekers (PENDING) ---- */

  for (let i = 0; i < seekerCount; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastNameWithStar = makeStarLastName(); // includes "*"
    const lastNameBase = stripStars(lastNameWithStar);
    const companyName = `${pick(COMPANY_PREFIXES)} ${pick(COMPANY_SUFFIXES)}`;
    const city = pick(CITY_NAMES);
    const state = pick(statePool);
    const zip = randomZip();

    const deliveryVerticals = pickSome(
      VERTICALS,
      1,
      Math.min(3, VERTICALS.length)
    );
    const insuranceType = pick(INSURANCE_TYPES);

    const vehicleYear = String(randomInt(2010, 2024));
    const vehicleMake = pick(["Ford", "Chevy", "Mercedes", "Ram", "Nissan", "Toyota"]);
    const vehicleModel = pick(["Transit", "Sprinter", "Promaster", "NV200", "Econoline"]);

    const refCompany = `${pick(COMPANY_PREFIXES)} ${pick(COMPANY_SUFFIXES)}`;
    const refLast = pick(LAST_NAMES);
    const refFirst = pick(FIRST_NAMES);

    const seekerSlugFirst = slugify(firstName);
    const seekerSlugLast = slugify(lastNameBase || "last");
    const companySlug = slugify(companyName || "seekerco");
    const seekerEmail = `${seekerSlugFirst}.${seekerSlugLast}@${companySlug}.com`;
    const seekerPhone = randomPhone();

    const refEmail = `${slugify(refFirst)}.${slugify(refLast)}@${slugify(
      refCompany
    )}.com`;
    const refPhone = randomPhone();

    const subCount = randomInt(0, 3);
    const subcontractors = Array.from({ length: subCount }).map(() => ({
      id: makeTempId("sub"),
      firstName: pick(FIRST_NAMES),
      lastName: pick(LAST_NAMES),
      title: pick(["Lead Driver", "Route Specialist", "Backup Driver"]),
      bio: "Independent operator supporting the master Seeker team.",
      email: `${slugify(pick(FIRST_NAMES))}.${slugify(pick(LAST_NAMES))}@${companySlug}.com`,
      phone: randomPhone(),
    }));

    const hierarchyNodes = subcontractors.slice(0, 2).map((sub, idx) => ({
      id: sub.id,
      x: 200 + idx * 140,
      y: 120 + idx * 40,
    }));

    addSeekerForcePending({
      firstName,
      lastName: lastNameWithStar, // shows "*" in UI for easy filtering
      companyName,
      birthday: randomDateOfBirth(),
      city,
      state,
      zip,
      yearsInBusiness: randomInt(0, 15),
      deliveryVerticals,
      vehicleYear,
      vehicleMake,
      vehicleModel,
      insuranceType,
      references: [
        {
          name: `${refFirst} ${refLast}`,
          company: refCompany,
          phone: refPhone,
          email: refEmail,
        },
      ],
      createdAt: nowIso,
      role: "SEEKER",
      status: "PENDING",
      // extra fields for UI
      email: seekerEmail,
      phone: seekerPhone,
      availability: randomWeeklyAvailability(),
      subcontractors,
      hierarchyNodes,
    } as any);
  }
  try {
    const seekerSelectableIds = getSelectableBadges("SEEKER").map((b) => b.id);
    const retainerSelectableIds = getSelectableBadges("RETAINER").map((b) => b.id);
    const seekerBackgroundIds = getBackgroundBadges("SEEKER").map((b) => b.id);
    const retainerBackgroundIds = getBackgroundBadges("RETAINER").map((b) => b.id);
    const seekerSnapIds = getSnapBadges("SEEKER").map((b) => b.id);
    const retainerSnapIds = getSnapBadges("RETAINER").map((b) => b.id);

    const allSeekers = getSeekers().filter((s: any) => s.status !== "DELETED");
    const allRetainers = getRetainers().filter((r: any) => r.status !== "DELETED");

    const pickSeedSeekerTier = (idx: number): "TRIAL" | "STARTER" | "GROWTH" | "ELITE" => {
      if (idx === 0) return "STARTER";
      const roll = randomInt(1, 100);
      if (roll <= 45) return "TRIAL";
      if (roll <= 70) return "STARTER";
      if (roll <= 90) return "GROWTH";
      return "ELITE";
    };

    allRetainers.forEach((r: any) => {
      setRetainerTier(String(r.id), "STARTER");
    });

    allSeekers.forEach((s: any, idx: number) => {
      setSeekerTier(String(s.id), pickSeedSeekerTier(idx));
    });

    for (const s of allSeekers) {
      const seekerId = String((s as any).id);
      if (seekerSelectableIds.length > 0) {
        setActiveBadges("SEEKER", seekerId, pickSome(seekerSelectableIds, 1, 2));
      }
      if (seekerBackgroundIds.length > 0) {
        setBackgroundBadges("SEEKER", seekerId, pickSome(seekerBackgroundIds, 4, 4), { allowOverride: true });
      }
      if (seekerSnapIds.length > 0) {
        grantSnapBadge("SEEKER", seekerId, seekerSnapIds[0]);
      }
    }

    for (const r of allRetainers) {
      const retainerId = String((r as any).id);
      if (retainerSelectableIds.length > 0) {
        setActiveBadges("RETAINER", retainerId, pickSome(retainerSelectableIds, 1, 2));
      }
      if (retainerBackgroundIds.length > 0) {
        setBackgroundBadges("RETAINER", retainerId, pickSome(retainerBackgroundIds, 4, 4), { allowOverride: true });
      }
      if (retainerSnapIds.length > 0) {
        grantSnapBadge("RETAINER", retainerId, retainerSnapIds[0]);
      }
    }

    const seededLinks: Array<{ seekerId: string; retainerId: string }> = [];
    const linkPairs = new Set<string>();
    const retainerLinkCounts = new Map<string, number>();

    const addActiveLink = (seekerId: string, retainerId: string) => {
      const key = `${seekerId}:${retainerId}`;
      if (linkPairs.has(key)) return false;
      linkPairs.add(key);

      requestLink({ seekerId, retainerId, by: "SEEKER" });
      requestLink({ seekerId, retainerId, by: "RETAINER" });
      setLinkVideoConfirmed({ seekerId, retainerId, by: "SEEKER", value: true });
      setLinkVideoConfirmed({ seekerId, retainerId, by: "RETAINER", value: true });
      setLinkApproved({ seekerId, retainerId, by: "SEEKER", value: true });
      setLinkApproved({ seekerId, retainerId, by: "RETAINER", value: true });
      setWorkingTogether({ seekerId, retainerId, by: "SEEKER", value: true });
      setWorkingTogether({ seekerId, retainerId, by: "RETAINER", value: true });

      retainerLinkCounts.set(retainerId, (retainerLinkCounts.get(retainerId) ?? 0) + 1);
      seededLinks.push({ seekerId, retainerId });
      return true;
    };

    const seekerIds = allSeekers
      .filter((s: any) => getSeekerEntitlements(String((s as any).id)).tier !== "TRIAL")
      .map((s: any) => String((s as any).id));
    const retainerIds = allRetainers.map((r: any) => String((r as any).id));

    let retainerIdx = 0;
    for (const seekerId of seekerIds) {
      const retainerId = retainerIds[retainerIdx % retainerIds.length];
      addActiveLink(seekerId, retainerId);
      retainerIdx += 1;
    }

    for (const retainerId of retainerIds) {
      if ((retainerLinkCounts.get(retainerId) ?? 0) > 0) continue;
      const seekerId = pick(seekerIds);
      addActiveLink(seekerId, retainerId);
    }

    const badgeCheckins: SubmitWeeklyCheckinArgs[] = [];

    for (const link of seededLinks) {
      const seekerId = link.seekerId;
      const retainerId = link.retainerId;

      const seekerActive = getActiveBadges("SEEKER", seekerId);
      const retainerActive = getActiveBadges("RETAINER", retainerId);
      const seekerBackground = getSelectedBackgroundBadges("SEEKER", seekerId);
      const retainerBackground = getSelectedBackgroundBadges("RETAINER", retainerId);
      const seekerPool = Array.from(new Set([...seekerBackground, ...seekerActive]));
      const retainerPool = Array.from(new Set([...retainerBackground, ...retainerActive]));
      const seekerSample = seekerPool.slice(0, Math.min(2, seekerPool.length));
      const retainerSample = retainerPool.slice(0, Math.min(2, retainerPool.length));
      const yesThresholds = buildYesThresholdSeries(historyDates.length);

      historyDates.forEach((dt, idx) => {
        const weekKey = isoWeekKeyForDate(dt);
        const dtIso = dt.toISOString();
        const yesThreshold = yesThresholds[idx] ?? 6;

        for (const badgeId of seekerSample) {
          badgeCheckins.push({
            badgeId,
            weekKey,
            cadence: "WEEKLY",
            value: randomInt(0, 9) < yesThreshold ? "YES" : "NO",
            seekerId,
            retainerId,
            targetRole: "SEEKER",
            targetId: seekerId,
            verifierRole: "RETAINER",
            verifierId: retainerId,
            createdAt: dtIso,
            updatedAt: dtIso,
          });
        }

        for (const badgeId of retainerSample) {
          badgeCheckins.push({
            badgeId,
            weekKey,
            cadence: "WEEKLY",
            value: randomInt(0, 9) < yesThreshold ? "YES" : "NO",
            seekerId,
            retainerId,
            targetRole: "RETAINER",
            targetId: retainerId,
            verifierRole: "SEEKER",
            verifierId: seekerId,
            createdAt: dtIso,
            updatedAt: dtIso,
          });
        }
      });
    }

    if (badgeCheckins.length > 0) {
      submitWeeklyCheckinsBatch(badgeCheckins);
    }
    clearSeedScoreHistory();

    const seedHistory = (ownerRole: "SEEKER" | "RETAINER", ownerId: string) => {
      historyDates.forEach((dt) => {
        const score = computeSeedScoreForProfileAtDate({
          ownerRole,
          ownerId,
          asOf: dt,
        });
        addReputationScoreHistoryEntry({
          ownerRole,
          ownerId,
          score: score ?? clampReputationScoreValue(REPUTATION_SCORE_MIN + 200),
          createdAt: dt.toISOString(),
          note: "Seeded 14-day score history",
        });
      });
    };

    for (const s of allSeekers) seedHistory("SEEKER", String((s as any).id));
    for (const r of allRetainers) seedHistory("RETAINER", String((r as any).id));
  } catch {
    // best-effort
  }

}

const SEED_TAG_PATTERN = /\s*\[[A-Z]{2}\]/g;

function stripSeedTags(value: string): string {
  return String(value || "").replace(SEED_TAG_PATTERN, "").trim();
}

function applySeedTags(value: string, tags: string[]): string {
  const clean = stripSeedTags(value);
  const unique = Array.from(new Set(tags.filter(Boolean)));
  if (unique.length === 0) return clean;
  return `${clean} [${unique.join("][")}]`;
}

function updateProfileInStorage(
  role: "SEEKER" | "RETAINER",
  id: string,
  updater: (current: any) => any
) {
  if (typeof window === "undefined") return;
  if (!id) return;

  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;

      const raw = storage.getItem(key);
      if (!raw) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const replaceInArray = (arr: any[]) => {
        const idx = arr.findIndex(
          (item) => item && item.id === id && (item.role === role || !item.role)
        );
        if (idx === -1) return null;
        const next = [...arr];
        next[idx] = updater(next[idx]);
        return next;
      };

      if (
        parsed &&
        typeof parsed === "object" &&
        "schemaVersion" in (parsed as any) &&
        "data" in (parsed as any)
      ) {
        const env = parsed as any;
        if (!Array.isArray(env.data)) continue;
        const next = replaceInArray(env.data);
        if (next) {
          storage.setItem(key, JSON.stringify({ schemaVersion: env.schemaVersion, data: next }));
          break;
        }
        continue;
      }

      if (Array.isArray(parsed)) {
        const next = replaceInArray(parsed);
        if (next) {
          storage.setItem(key, JSON.stringify(next));
          break;
        }
      }
    }
  } catch {
    // best-effort
  }
}

/**
 * Comprehensive seed for the localStorage-driven portal:
 * - 5 retainers
 * - 5 seekers
 * - All commonly used profile fields filled
 * - Unique emails, phones, names, and company names within the seed run
 * - Deterministic in the sense that values are generated in-process and stored in localStorage
 */
export function autoSeedComprehensive(opts: ComprehensiveSeedOptions = {}): void {
  const retainerCount = opts.retainers ?? 5;
  const seekerCount = opts.seekers ?? 5;

  const retainersSmallTeams = Math.min(opts.retainersSmallTeams ?? 10, retainerCount);
  const retainersLargeTeams = Math.min(opts.retainersLargeTeams ?? 10, Math.max(0, retainerCount - retainersSmallTeams));

  const smallTeamUserMin = opts.smallTeamUserMin ?? 2;
  const smallTeamUserMax = opts.smallTeamUserMax ?? 5;
  const largeTeamUserMin = opts.largeTeamUserMin ?? 6;
  const largeTeamUserMax = opts.largeTeamUserMax ?? 15;

  const seekersWithSubcontractors = Math.min(opts.seekersWithSubcontractors ?? 40, seekerCount);
  const subcontractorMin = opts.subcontractorMin ?? 1;
  const subcontractorMax = opts.subcontractorMax ?? 8;

  const force = opts.force ?? true;
  if (force) wipeDemoLocalStorageComprehensive();

  const statePool = US_STATES.length ? US_STATES : ["FL"];

  const usedEmails = new Set<string>();
  const usedPhones = new Set<string>();
  const usedCompanies = new Set<string>();
  const usedFullNames = new Set<string>();

  const makeUniqueCompany = () =>
    uniqueValue(() => {
      const prefix = pick(COMPANY_PREFIXES);
      const descriptor = pick(COMPANY_DESCRIPTORS);
      const suffix = pick(COMPANY_SUFFIXES);
      return `${prefix} ${descriptor} ${suffix}`;
    }, usedCompanies);

  const SYLLABLES = [
    "al","an","ar","ben","bra","cal","car","dan","del","den","el","en","er","ev",
    "fi","for","ga","gen","har","in","ja","jen","kai","ken","la","len","li","lin",
    "mar","mel","mon","na","nel","no","ol","or","pa","pen","qui","ran","re","ri",
    "sa","sel","sha","son","ta","ten","tor","tri","val","ven","wel","win","ya","zen",
  ];

  const makePronounceable = (minSyllables: number, maxSyllables: number) => {
    const count = randomInt(minSyllables, maxSyllables);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) parts.push(pick(SYLLABLES));
    const raw = parts.join("");
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const makeUniquePersonName = () => {
    // Use a large space so we don't fall back to random IDs.
    return uniqueValue(() => {
      const first = randomInt(0, 1) === 0 ? pick(FIRST_NAMES) : makePronounceable(2, 3);
      const lastBase = randomInt(0, 1) === 0 ? pick(LAST_NAMES) : makePronounceable(2, 3);
      return `${first} ${lastBase}`;
    }, usedFullNames);
  };

  const makeUniqueEmail = (first: string, last: string, domain: string) => {
    const baseLocal = `${slugify(first)}.${slugify(stripStars(last))}`.replace(/\.+/g, ".");
    const baseDomain = `${slugify(domain)}.com`;

    return uniqueValue(() => {
      // No random strings: increment if we collide.
      let n = 0;
      let candidate = `${baseLocal}@${baseDomain}`;
      while (usedEmails.has(candidate)) {
        n += 1;
        candidate = `${baseLocal}+${String(n).padStart(3, "0")}@${baseDomain}`;
      }
      return candidate;
    }, usedEmails);
  };

  const makeUniquePhone = () =>
    uniqueValue(() => randomPhone(), usedPhones);

  const statusForRetainer = (index: number) => {
    // Keep portals functional: most approved, some pending/rejected/deleted for admin filters.
    const roll = index % 10;
    if (roll <= 5) return "APPROVED";
    if (roll <= 7) return "PENDING";
    if (roll === 8) return "REJECTED";
    return "DELETED";
  };

  const statusForSeeker = (index: number) => {
    const roll = index % 20;
    if (roll <= 14) return "APPROVED";
    if (roll <= 17) return "PENDING";
    if (roll === 18) return "REJECTED";
    return "DELETED";
  };

  const MESSAGE_SEED_RETAINERS = 2;
  const MESSAGE_SEED_SEEKERS = 2;
  const msRetainers: { retainerId: string; staffUserIds: string[] }[] = [];
  const msSeekers: { seekerId: string; subcontractorIds: string[] }[] = [];
  const seededLinks: Array<{ seekerId: string; retainerId: string }> = [];
  const seekerSeedFlags = new Map<string, { messageSeed: boolean; master: boolean }>();
  const retainerSeedFlags = new Map<string, { messageSeed: boolean }>();

  // --- Retainers ---
  for (let i = 0; i < retainerCount; i++) {
    const companyName = makeUniqueCompany();
    const baseCeoName = makeUniquePersonName();
    const [ceoFirst, ceoLastBase] = baseCeoName.split(" ");

    const city = pick(CITY_NAMES);
    const state = pick(statePool);
    const zip = randomZip();

    const deliveryVerticals = pickSome(VERTICALS, 2, Math.min(4, VERTICALS.length));
    const desiredTraits = pickSome(TRAITS, 3, Math.min(6, TRAITS.length));

    const yearsInBusiness = randomInt(1, 25);
    const employees = randomInt(5, 500);

    const email = makeUniqueEmail(ceoFirst || "ceo", ceoLastBase || "owner", companyName);
    const phone = makeUniquePhone();

    const logoUrl = avatarDataUri(companyName, `retainer:${companyName}`);
    const facilityPhoto1 = placeholderImageDataUri(`${companyName} - Facility 1`, `facility1:${companyName}`);
    const facilityPhoto2 = placeholderImageDataUri(`${companyName} - Facility 2`, `facility2:${companyName}`);
    const facilityPhoto3 = placeholderImageDataUri(`${companyName} - Facility 3`, `facility3:${companyName}`);

    const mission = `We operate a ${pick(["high-touch", "high-volume", "tech-enabled", "white-glove"])} delivery network focused on ${pick(["reliability", "speed", "brand safety", "customer experience"])} across ${city} and surrounding markets.`;

    const userLevelLabels = {
      level1: pick(["Viewer", "Read-only", "Observer"]),
      level2: pick(["Manager", "Operator", "Lead"]),
      level3: pick(["Owner", "Admin", "Executive"]),
    };

    let userCount = 1; // owner-only by default
    if (i < retainersSmallTeams) {
      userCount = randomInt(smallTeamUserMin, smallTeamUserMax);
    } else if (i < retainersSmallTeams + retainersLargeTeams) {
      userCount = randomInt(largeTeamUserMin, largeTeamUserMax);
    }

    const isMessageSeedRetainer =
      i < retainersSmallTeams &&
      msRetainers.length < MESSAGE_SEED_RETAINERS &&
      userCount >= 2;

    const ownerLastName = ceoLastBase || pick(LAST_NAMES);

    const ownerUserId = makeTempId("ru");
    const ownerUser = {
      id: ownerUserId,
      firstName: ceoFirst || pick(FIRST_NAMES),
      lastName: ownerLastName,
      title: userLevelLabels.level3,
      email,
      phone,
      photoUrl: avatarDataUri(
        `${ceoFirst ?? ""} ${stripStars(ceoLastBase ?? "")}`.trim() || companyName,
        `ru:${ownerUserId}`
      ),
      bio: `Primary contact for ${companyName}.`,
      level: 3,
    };

    const users: any[] = [ownerUser];
    while (users.length < userCount) {
      const full = makeUniquePersonName();
      const [first, last] = full.split(" ");
      const uid = makeTempId("ru");
      const levelRoll = randomInt(1, 3) as 1 | 2 | 3;
      const title =
        levelRoll === 3
          ? userLevelLabels.level3
          : levelRoll === 2
          ? pick(["Ops Manager", "Dispatch Lead", "Fleet Manager", "Account Manager"])
          : pick(["Viewer", "Coordinator", "Assistant", "Analyst"]);

      users.push({
        id: uid,
        firstName: first || pick(FIRST_NAMES),
        lastName: last || pick(LAST_NAMES),
        title,
        email: makeUniqueEmail(first || "user", last || "last", companyName),
        phone: makeUniquePhone(),
        photoUrl: avatarDataUri(full, `ru:${uid}`),
        bio: `Internal staff at ${companyName}.`,
        level: levelRoll,
      });
    }

    const ceoName = `${ceoFirst || pick(FIRST_NAMES)} ${ownerLastName}`.trim();

    const payCycleCloseDay = pick(DAYS).key;
    const payCycleFrequency = pick(PAY_CYCLE_FREQUENCIES).value;

    const retainer = addRetainer({
      companyName,
      ceoName,
      city,
      state,
      zip,
      mission,
      yearsInBusiness,
      employees,
      deliveryVerticals,
      desiredTraits,
      payCycleCloseDay,
      payCycleFrequency,
      payCycleTimezone: "EST",
      role: "RETAINER",
      status: isMessageSeedRetainer ? "APPROVED" : statusForRetainer(i),
      email,
      phone,
      logoUrl,
      facilityPhoto1,
      facilityPhoto2,
      facilityPhoto3,
      users,
      userLevelLabels,
    } as any);

    retainerSeedFlags.set(retainer.id, { messageSeed: isMessageSeedRetainer });

    if (users.length > 0) {
      const nodes = users.map((u, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const parentId =
          idx === 0 ? undefined : idx < 4 ? retainer.id : users[randomInt(0, Math.min(idx - 1, 3))]?.id;
        return {
          id: u.id,
          x: 120 + col * 280,
          y: 160 + row * 120,
          parentId,
        };
      });
      setRetainerHierarchyNodes(retainer.id, nodes as any);
    }

    if (isMessageSeedRetainer) {
      msRetainers.push({
        retainerId: retainer.id,
        staffUserIds: users.slice(1).map((u) => String(u.id)),
      });
    }
  }

  // --- Seekers ---
  for (let i = 0; i < seekerCount; i++) {
    const fullName = makeUniquePersonName();
    const [firstName, lastNameBase] = fullName.split(" ");

    const companyName = makeUniqueCompany();
    const city = pick(CITY_NAMES);
    const state = pick(statePool);
    const zip = randomZip();

    const email = makeUniqueEmail(firstName || "seeker", lastNameBase || "driver", companyName);
    const phone = makeUniquePhone();

    const deliveryVerticals = pickSome(VERTICALS, 2, Math.min(4, VERTICALS.length));
    const insuranceType = pick(INSURANCE_TYPES);

    const vehicleYear = String(randomInt(2012, 2025));
    const vehicleMake = pick(["Ford", "Chevrolet", "Mercedes-Benz", "Ram", "Nissan", "Toyota"]);
    const vehicleModel = pick(["Transit", "Express", "Sprinter", "ProMaster", "NV200", "HiAce"]);
    const vehicle = `${vehicleYear} ${vehicleMake} ${vehicleModel}`;

    const photoUrl = avatarDataUri(`${firstName ?? ""} ${lastNameBase ?? ""}`.trim(), `seeker:${email}`);
    const vehiclePhoto1 = placeholderImageDataUri(`${vehicle} - Photo 1`, `v1:${email}`);
    const vehiclePhoto2 = placeholderImageDataUri(`${vehicle} - Photo 2`, `v2:${email}`);
    const vehiclePhoto3 = placeholderImageDataUri(`${vehicle} - Photo 3`, `v3:${email}`);

    const ref1Name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const ref2Name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

    const ref1Company = makeUniqueCompany();
    const ref2Company = makeUniqueCompany();

    const ref1 = {
      name: ref1Name,
      phone: makeUniquePhone(),
      email: makeUniqueEmail(ref1Name.split(" ")[0] || "ref", ref1Name.split(" ")[1] || "one", ref1Company),
      company: ref1Company,
    };
    const ref2 = {
      name: ref2Name,
      phone: makeUniquePhone(),
      email: makeUniqueEmail(ref2Name.split(" ")[0] || "ref", ref2Name.split(" ")[1] || "two", ref2Company),
      company: ref2Company,
    };

    const availability = randomWeeklyAvailability();
    const notes = `Prefers ${pick(["steady routes", "high stop counts", "medical runs", "overnight routes", "same-day work"])}. Strong communication; GPS + scanner ready.`;

    const birthday = randomDateOfBirth();
    const yearsInBusiness = randomInt(0, 18);

    const shouldHaveSubs = i < seekersWithSubcontractors;
    const isMessageSeedSeeker =
      shouldHaveSubs &&
      msSeekers.length < MESSAGE_SEED_SEEKERS;

    const lastNameFinal = lastNameBase || pick(LAST_NAMES);

    const subcontractors = shouldHaveSubs
      ? Array.from({ length: randomInt(subcontractorMin, subcontractorMax) }).map(() => {
          const subFull = makeUniquePersonName();
          const [sf, sl] = subFull.split(" ");
          const sid = makeTempId("sub");
          return {
            id: sid,
            firstName: sf || pick(FIRST_NAMES),
            lastName: sl || pick(LAST_NAMES),
            title: pick(["Lead Driver", "Route Specialist", "Backup Driver", "Weekend Coverage"]),
            email: makeUniqueEmail(sf || "sub", sl || "driver", companyName),
            phone: makeUniquePhone(),
            photoUrl: avatarDataUri(subFull, `sub:${sid}`),
            bio: `Subcontractor supporting ${firstName} ${lastNameBase || ""}`.trim(),
          };
        })
      : [];

    const seeker = addSeeker({
      firstName: firstName || pick(FIRST_NAMES),
      lastName: lastNameFinal,
      companyName,
      birthday,
      city,
      state,
      zip,
      yearsInBusiness,
      deliveryVerticals,
      vehicle,
      insuranceType,
      role: "SEEKER",
      status: isMessageSeedSeeker ? "APPROVED" : statusForSeeker(i),
      email,
      phone,
      availability,
      notes,
      photoUrl,
      vehiclePhoto1,
      vehiclePhoto2,
      vehiclePhoto3,
      ref1,
      ref2,
      subcontractors,
    } as any);

    seekerSeedFlags.set(seeker.id, {
      messageSeed: isMessageSeedSeeker,
      master: subcontractors.length > 0,
    });

    if (subcontractors.length > 0) {
      const nodes = subcontractors.map((sub, idx) => ({
        id: sub.id,
        x: 140 + (idx % 3) * 280,
        y: 160 + Math.floor(idx / 3) * 120,
        parentId: seeker.id,
      }));
      setSeekerHierarchyNodes(seeker.id, nodes as any);
    }

    if (isMessageSeedSeeker) {
      msSeekers.push({
        seekerId: seeker.id,
        subcontractorIds: subcontractors.map((s) => String(s.id)),
      });
    }
  }

  // --- Seed message traffic ONLY for (MS) profiles ---
  try {
    const approvedSeekers = getSeekers().filter((s: any) => s.status !== "DELETED");
    const approvedRetainers = getRetainers().filter((r: any) => r.status !== "DELETED");

    const msSeekerIds = new Set(msSeekers.map((s) => s.seekerId));
    const msRetainerIds = new Set(msRetainers.map((r) => r.retainerId));

    const msSeekersApproved = approvedSeekers.filter((s: any) => msSeekerIds.has(s.id));
    const msRetainersApproved = approvedRetainers.filter((r: any) => msRetainerIds.has(r.id));

    if (msSeekersApproved.length > 0 && msRetainersApproved.length > 0) {
      const SUBJECTS = [
        "Weekly route coverage check-in",
        "Onboarding steps and paperwork",
        "Availability and start date",
        "Rate confirmation and expectations",
        "Dispatch workflow details",
      ];

      const SEEKER_OPENERS = [
        "Hello - confirming availability and looking to review lane details and expectations.",
        "Hi - I can cover this route consistently. Please confirm the pickup window and start date.",
        "Good morning - sharing next week's availability. Can you confirm dispatch timing and cutoff?",
        "Hi there - ready to onboard. Please send the checklist and required documents.",
        "Hey - can you confirm rate details and any required training before start?",
      ];

      const RETAINER_REPLIES = [
        "Thanks for the note. Next steps are onboarding paperwork and a route brief.",
        "Pickup is typically in the morning. I'll send location access notes shortly.",
        "Please confirm you can meet the daily cutoff and provide ETAs for exceptions.",
        "Great. I'll send the rate confirmation today so we can lock in coverage.",
        "Appreciate it. We'll share the start date once compliance is complete.",
      ];

      const SEEKER_FOLLOWUPS = [
        "Confirmed. I'll meet cutoff daily and keep dispatch updated throughout.",
        "Sounds good. Please include loading instructions and parking notes.",
        "Understood. I'll return the checklist the same day.",
        "Perfect. I can align to your check-in cadence for the first week.",
        "All good. Once I receive details, I'll confirm the start date.",
      ];

      for (const seeker of msSeekersApproved) {
        for (const retainer of msRetainersApproved) {
          const subject = SUBJECTS[randomInt(0, SUBJECTS.length - 1)];
          const created = createConversationWithFirstMessage({
            seekerId: seeker.id,
            retainerId: retainer.id,
            subject,
            body: SEEKER_OPENERS[randomInt(0, SEEKER_OPENERS.length - 1)],
            senderRole: "SEEKER",
          });

          const convId = created.conversation.id;
          const perSide = randomInt(2, 4);
          const totalAdditional = perSide * 2 - 1;
          for (let m = 0; m < totalAdditional; m++) {
            const isSeekerTurn = m % 2 === 1;
            addMessageToConversation({
              conversationId: convId,
              senderRole: isSeekerTurn ? "SEEKER" : "RETAINER",
              body: isSeekerTurn
                ? SEEKER_FOLLOWUPS[randomInt(0, SEEKER_FOLLOWUPS.length - 1)]
                : RETAINER_REPLIES[randomInt(0, RETAINER_REPLIES.length - 1)],
            });
          }
        }
      }
    }
  } catch {
    // best-effort
  }

  // --- Internal messages for (MS) profiles ---
  try {
    // Retainer staff threads (per staff user)
    const OWNER_TO_STAFF = [
      "Quick check-in: confirm today's coverage status and any exceptions.",
      "Please review next week's schedule and flag conflicts by EOD.",
      "Confirm onboarding completion for the new contractor and missing items.",
      "Post an update once dispatch confirms final route counts.",
      "Share any customer escalations that need follow-up today.",
    ];
    const STAFF_TO_OWNER = [
      "Confirmed. Coverage looks solid; I'll update if anything changes.",
      "Copy that. I'll review and share conflicts within the hour.",
      "Understood. I'll follow up on missing items and update the checklist.",
      "Will do. Dispatch is finalizing counts; I'll post an update shortly.",
      "Noted. I'll summarize escalations and next steps by end of day.",
    ];

    for (const r of msRetainers) {
      for (const staffUserId of r.staffUserIds) {
        const perSide = randomInt(2, 4);
        const msgCount = perSide * 2;
        for (let i = 0; i < msgCount; i++) {
          const fromOwner = i % 2 === 0;
          addRetainerStaffMessage({
            retainerId: r.retainerId,
            userId: staffUserId,
            sender: fromOwner ? "OWNER" : "STAFF",
            body: fromOwner
              ? OWNER_TO_STAFF[randomInt(0, OWNER_TO_STAFF.length - 1)]
              : STAFF_TO_OWNER[randomInt(0, STAFF_TO_OWNER.length - 1)],
          });
        }
      }
    }

    // Seeker <-> subcontractor threads (per subcontractor)
    const MASTER_TO_SUB = [
      "Confirm your availability for tomorrow's shift and planned start time.",
      "Send a quick status update after your first 10 stops.",
      "Reminder: capture photos for any exceptions and message me immediately.",
      "Can you cover an extra lane next week? I'll share details if yes.",
      "Please confirm today's route pickup window and access notes.",
    ];
    const SUB_TO_MASTER = [
      "Confirmed - available and ready at the planned start time.",
      "Understood. I'll send an update after the first 10 stops.",
      "Copy that. I'll capture photos for exceptions and escalate fast.",
      "Yes, I can cover. Send the lane details and I'll confirm.",
      "Got it. Pickup window is clear; I'll message if anything changes.",
    ];

    for (const s of msSeekers) {
      for (const subId of s.subcontractorIds) {
        const perSide = randomInt(2, 4);
        const msgCount = perSide * 2;
        for (let i = 0; i < msgCount; i++) {
          const fromMaster = i % 2 === 0;
          addSubcontractorMessage({
            seekerId: s.seekerId,
            subcontractorId: subId,
            sender: fromMaster ? "MASTER" : "SUBCONTRACTOR",
            body: fromMaster
              ? MASTER_TO_SUB[randomInt(0, MASTER_TO_SUB.length - 1)]
              : SUB_TO_MASTER[randomInt(0, SUB_TO_MASTER.length - 1)],
          });
        }
      }
    }
  } catch {
    // best-effort
  }

  // --- Linking + Social content (MS) ---
  try {
    const allSeekers = getSeekers();
    const allRetainers = getRetainers();

    const approvedSeekers = allSeekers.filter((s: any) => s.status === "APPROVED");
    const approvedRetainers = allRetainers.filter((r: any) => r.status === "APPROVED");

    const randomMemberSinceIso = () => {
      const daysBack = randomInt(30, 1825);
      const dt = new Date();
      dt.setDate(dt.getDate() - daysBack);
      return dt.toISOString();
    };

    for (const s of approvedSeekers as any[]) {
      updateProfileInStorage("SEEKER", String(s.id), (current) => ({
        ...current,
        createdAt: randomMemberSinceIso(),
      }));
    }

    for (const r of approvedRetainers as any[]) {
      updateProfileInStorage("RETAINER", String(r.id), (current) => ({
        ...current,
        createdAt: randomMemberSinceIso(),
      }));
    }

    const msSeekerIdSet = new Set(msSeekers.map((s) => s.seekerId));
    const msRetainerIdSet = new Set(msRetainers.map((r) => r.retainerId));

    const msApprovedSeekers = approvedSeekers.filter((s: any) => msSeekerIdSet.has(s.id));
    const msApprovedRetainers = approvedRetainers.filter((r: any) => msRetainerIdSet.has(r.id));

    const shuffle = <T,>(arr: T[]): T[] => {
      const next = [...arr];
      for (let i = next.length - 1; i > 0; i--) {
        const j = randomInt(0, i);
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    };

    const pickRetainerTier = (): "STARTER" | "GROWTH" | "ENTERPRISE" => {
      const roll = randomInt(1, 100);
      if (roll <= 55) return "STARTER";
      if (roll <= 85) return "GROWTH";
      return "ENTERPRISE";
    };

    const pickSeekerTier = (): "TRIAL" | "STARTER" | "GROWTH" | "ELITE" => {
      const roll = randomInt(1, 100);
      if (roll <= 35) return "TRIAL";
      if (roll <= 70) return "STARTER";
      if (roll <= 90) return "GROWTH";
      return "ELITE";
    };

    approvedRetainers.forEach((r: any) => {
      setRetainerTier(String(r.id), pickRetainerTier());
    });

    approvedSeekers.forEach((s: any) => {
      setSeekerTier(String(s.id), pickSeekerTier());
    });

    // Ensure some retainers can post public content for feed testing.
    msApprovedRetainers.forEach((r: any, idx: number) => {
      setRetainerTier(String(r.id), idx === 0 ? "ENTERPRISE" : "GROWTH");
    });

    const linkPairs = new Set<string>();
    const seekerLinkCounts = new Map<string, number>();
    const retainerLinkCounts = new Map<string, number>();

    const addActiveLink = (seekerId: string, retainerId: string) => {
      const key = `${seekerId}:${retainerId}`;
      if (linkPairs.has(key)) return false;
      linkPairs.add(key);

      requestLink({ seekerId, retainerId, by: "SEEKER" });
      requestLink({ seekerId, retainerId, by: "RETAINER" });
      setLinkVideoConfirmed({ seekerId, retainerId, by: "SEEKER", value: true });
      setLinkVideoConfirmed({ seekerId, retainerId, by: "RETAINER", value: true });
      setLinkApproved({ seekerId, retainerId, by: "SEEKER", value: true });
      setLinkApproved({ seekerId, retainerId, by: "RETAINER", value: true });

      seekerLinkCounts.set(seekerId, (seekerLinkCounts.get(seekerId) ?? 0) + 1);
      retainerLinkCounts.set(retainerId, (retainerLinkCounts.get(retainerId) ?? 0) + 1);
      seededLinks.push({ seekerId, retainerId });
      return true;
    };

    const paidSeekers = approvedSeekers.filter(
      (s: any) => getSeekerEntitlements(String(s.id)).tier !== "TRIAL"
    );

    if (paidSeekers.length > 0 && approvedRetainers.length > 0) {
      const shuffledSeekers = shuffle(paidSeekers);
      const shuffledRetainers = shuffle(approvedRetainers);

      const multiSeekerCount = Math.round(approvedSeekers.length * 0.2);
      const linkedSeekerCount = Math.round(approvedSeekers.length * 0.6);
      const multiRetainerCount = Math.round(approvedRetainers.length * 0.2);
      const linkedRetainerCount = Math.round(approvedRetainers.length * 0.6);

      const multiSeekers = new Set(
        shuffledSeekers.slice(0, multiSeekerCount).map((s: any) => String(s.id))
      );
      const linkedSeekers = new Set(
        shuffledSeekers.slice(0, linkedSeekerCount).map((s: any) => String(s.id))
      );

      const multiRetainers = new Set(
        shuffledRetainers.slice(0, multiRetainerCount).map((r: any) => String(r.id))
      );
      const linkedRetainers = new Set(
        shuffledRetainers.slice(0, linkedRetainerCount).map((r: any) => String(r.id))
      );

      const seekerTargetCounts = new Map<string, number>();
      for (const s of approvedSeekers as any[]) {
        const id = String(s.id);
        if (multiSeekers.has(id)) seekerTargetCounts.set(id, randomInt(2, 5));
        else if (linkedSeekers.has(id)) seekerTargetCounts.set(id, 1);
        else seekerTargetCounts.set(id, 0);
      }

      const retainerTargetMin = new Map<string, number>();
      for (const r of approvedRetainers as any[]) {
        const id = String(r.id);
        if (multiRetainers.has(id)) retainerTargetMin.set(id, randomInt(2, 5));
        else if (linkedRetainers.has(id)) retainerTargetMin.set(id, 1);
        else retainerTargetMin.set(id, 0);
      }

      const pickSeekerForRetainer = (retainerId: string) => {
        const withCapacity = approvedSeekers.filter((s: any) => {
          const sid = String(s.id);
          if (linkPairs.has(`${sid}:${retainerId}`)) return false;
          const target = seekerTargetCounts.get(sid) ?? 0;
          return (seekerLinkCounts.get(sid) ?? 0) < target;
        });
        const pool = withCapacity.length > 0 ? withCapacity : approvedSeekers;
        if (pool.length === 0) return null;
        return pool[randomInt(0, pool.length - 1)];
      };

      const pickRetainerForSeeker = (seekerId: string) => {
        const pool = approvedRetainers.filter(
          (r: any) => !linkPairs.has(`${seekerId}:${String(r.id)}`)
        );
        if (pool.length === 0) return null;
        return pool[randomInt(0, pool.length - 1)];
      };

      // Ensure 60% of retainers have at least one link; 20% have multiple.
      for (const r of approvedRetainers as any[]) {
        const retainerId = String(r.id);
        let needed = retainerTargetMin.get(retainerId) ?? 0;
        let guard = 0;
        while (needed > 0 && guard < approvedSeekers.length * 2) {
          const s = pickSeekerForRetainer(retainerId);
          if (!s) break;
          if (addActiveLink(String(s.id), retainerId)) needed -= 1;
          guard += 1;
        }
      }

      // Ensure seekers hit their target counts (60% linked, 20% multiple).
      for (const s of approvedSeekers as any[]) {
        const seekerId = String(s.id);
        const target = seekerTargetCounts.get(seekerId) ?? 0;
        let guard = 0;
        while ((seekerLinkCounts.get(seekerId) ?? 0) < target && guard < approvedRetainers.length * 2) {
          const r = pickRetainerForSeeker(seekerId);
          if (!r) break;
          addActiveLink(seekerId, String(r.id));
          guard += 1;
        }
      }

      // Make sure MS profiles get at least one active link.
      for (const s of msApprovedSeekers as any[]) {
        const seekerId = String(s.id);
        if ((seekerLinkCounts.get(seekerId) ?? 0) > 0) continue;
        const r = approvedRetainers[randomInt(0, approvedRetainers.length - 1)];
        if (r) addActiveLink(seekerId, String((r as any).id));
      }
      for (const r of msApprovedRetainers as any[]) {
        const retainerId = String(r.id);
        if ((retainerLinkCounts.get(retainerId) ?? 0) > 0) continue;
        const s = approvedSeekers[randomInt(0, approvedSeekers.length - 1)];
        if (s) addActiveLink(String((s as any).id), retainerId);
      }
    }

    const linkedSeekerIds = new Set(
      Array.from(seekerLinkCounts.entries())
        .filter(([, count]) => count > 0)
        .map(([id]) => id)
    );
    const multiSeekerIds = new Set(
      Array.from(seekerLinkCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id)
    );
    const linkedRetainerIds = new Set(
      Array.from(retainerLinkCounts.entries())
        .filter(([, count]) => count > 0)
        .map(([id]) => id)
    );
    const multiRetainerIds = new Set(
      Array.from(retainerLinkCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id)
    );

    for (const [id, flags] of seekerSeedFlags.entries()) {
      const tags: string[] = [];
      if (flags.messageSeed) tags.push("MS");
      if (flags.master) tags.push("MC");
      if (linkedSeekerIds.has(id)) tags.push("LK");
      if (multiSeekerIds.has(id)) tags.push("ML");

      updateProfileInStorage("SEEKER", id, (current) => ({
        ...current,
        lastName: applySeedTags(current.lastName, tags),
      }));
    }

    for (const [id, flags] of retainerSeedFlags.entries()) {
      const tags: string[] = [];
      if (flags.messageSeed) tags.push("MS");
      if (linkedRetainerIds.has(id)) tags.push("LK");
      if (multiRetainerIds.has(id)) tags.push("ML");

      updateProfileInStorage("RETAINER", id, (current) => ({
        ...current,
        companyName: applySeedTags(current.companyName, tags),
        ceoName: current.ceoName ? applySeedTags(current.ceoName, tags) : current.ceoName,
      }));
    }

    const POST_TITLES = [
      "Weekly route update and onboarding reminder",
      "New lanes opening soon",
      "Service expectations + communication standards",
      "Safety update and escalation policy",
      "Holiday coverage planning",
      "Recruiting update: consistent work available",
    ];

    const POST_BODIES = [
      "Thanks for staying engaged. Were prioritizing clear ETAs, proactive exception reporting, and consistent cutoff performance. If you have questions, message dispatch through your usual channel.",
      "We have additional capacity coming online. If youre available for steady coverage, mark Interested on posted routes and confirm your availability window.",
      "Reminder: start-of-shift check-in is required. Please confirm youve reviewed load notes and parking instructions before departure.",
      "Safety first: report any access issues, unsafe locations, or customer escalations immediately. We will support you and document the incident properly.",
      "Were planning holiday coverage now. If you can cover weekends or extended shifts, reply with your preferred schedule so we can align assignments.",
      "We value professional communication and reliability. If youre looking for consistent work, keep your profile updated and watch for route postings.",
    ];

    const BROADCAST_SUBJECTS = [
      "Dispatch update",
      "Schedule change notice",
      "Policy reminder",
      "Route coverage request",
      "Weather advisory",
    ];

    const BROADCAST_BODIES = [
      "Quick update from dispatch: please confirm your availability for upcoming shifts and report any conflicts as soon as possible.",
      "Heads up: schedule adjustments are in progress. Review posted routes and confirm coverage for any lanes you can support.",
      "Reminder: keep ETAs updated and escalate exceptions early. Consistent communication prevents missed cutoffs.",
      "We have a coverage gap for an active route. If you can support, mark Interested and message us with your preferred start time.",
      "Weather advisory: plan for delays and drive safely. Provide early notice if conditions will impact your ability to meet cutoff.",
    ];

    const ROUTE_TITLES = [
      "Route A - morning coverage",
      "Route B - afternoon coverage",
      "Weekend surge route",
      "Night shift lane",
      "Same-day overflow support",
    ];

    // Create posts/broadcasts/routes for MS retainers.
    for (let i = 0; i < msApprovedRetainers.length; i++) {
      const r: any = msApprovedRetainers[i];
      const retainerId = String(r.id);

      // Posts: a few linked-only, and 1 public for the first retainer.
      const postCount = 4;
      for (let p = 0; p < postCount; p++) {
        const isPublic = i === 0 && p === 0;
        createRetainerPost({
          retainerId,
          type: p === 0 ? "UPDATE" : p === 1 ? "AD" : "UPDATE",
          audience: isPublic ? "PUBLIC" : "LINKED_ONLY",
          title: POST_TITLES[randomInt(0, POST_TITLES.length - 1)],
          body: POST_BODIES[randomInt(0, POST_BODIES.length - 1)],
        });
      }

      // Broadcasts: create + deliver-to-inbox for linked seekers.
      const broadcastCount = 2;
      for (let b = 0; b < broadcastCount; b++) {
        const isPublic = i === 0 && b === 0;
        const created = createRetainerBroadcast({
          retainerId,
          audience: isPublic ? "PUBLIC" : "LINKED_ONLY",
          subject: BROADCAST_SUBJECTS[randomInt(0, BROADCAST_SUBJECTS.length - 1)],
          body: BROADCAST_BODIES[randomInt(0, BROADCAST_BODIES.length - 1)],
        });

        deliverRetainerBroadcastToLinkedSeekers({
          retainerId,
          subject: created.subject,
          body: created.body,
        });
      }

      // Routes: create a few so they appear in Routes and Feed.
      const routeCount = 3;
      for (let k = 0; k < routeCount; k++) {
        const isPublic = i === 0 && k === 0;
        const city = r.city ?? pick(CITY_NAMES);
        const state = r.state ?? pick(statePool);
        const sched = randomRouteScheduleV2();
        const route = createRoute({
          retainerId,
          title: ROUTE_TITLES[randomInt(0, ROUTE_TITLES.length - 1)],
          audience: isPublic ? "PUBLIC" : "LINKED_ONLY",
          vertical: pick(VERTICALS),
          city,
          state,
          schedule: sched.scheduleLabel,
          scheduleDays: sched.scheduleDays,
          scheduleStart: sched.scheduleStart,
          scheduleEnd: sched.scheduleEnd,
          scheduleTimezone: defaultTimezone(),
          payModel: pick(["Per day", "Per stop", "Hourly"]),
          payMin: randomInt(140, 240),
          payMax: randomInt(260, 420),
          openings: randomInt(1, 4),
          requirements: pick([
            "Valid license and insurance; smartphone required.",
            "Must be able to meet cutoff daily; strong communication required.",
            "Experience with scanners preferred; punctual start time required.",
          ]),
        });

        // Seed Interested signals from a few linked seekers.
        const sampleSeekers = msApprovedSeekers.slice(0, 3);
        for (const s of sampleSeekers) {
          if (randomInt(0, 1) === 0) continue;
          toggleInterest(String((s as any).id), route.id);
        }
      }
    }
  } catch {
    // best-effort
  }

  // --- Badges (active selection + progress) ---
  try {
    const seekerSelectableIds = getSelectableBadges("SEEKER").map((b) => b.id);
    const retainerSelectableIds = getSelectableBadges("RETAINER").map((b) => b.id);
    const seekerBackgroundIds = getBackgroundBadges("SEEKER").map((b) => b.id);
    const retainerBackgroundIds = getBackgroundBadges("RETAINER").map((b) => b.id);
    const seekerSnapIds = getSnapBadges("SEEKER").map((b) => b.id);
    const retainerSnapIds = getSnapBadges("RETAINER").map((b) => b.id);
    const seekerCheckerIds = getCheckerBadges("SEEKER").map((b) => b.id);
    const retainerCheckerIds = getCheckerBadges("RETAINER").map((b) => b.id);

    const approvedSeekers = getSeekers().filter((s: any) => s.status !== "DELETED");
    const approvedRetainers = getRetainers().filter((r: any) => r.status !== "DELETED");

    for (const s of approvedSeekers) {
      const seekerId = String((s as any).id);
      setActiveBadges("SEEKER", seekerId, pickSome(seekerSelectableIds, 1, 2));
      setBackgroundBadges("SEEKER", seekerId, pickSome(seekerBackgroundIds, 4, 4), { allowOverride: true });
      if (seekerSnapIds.length > 0) {
        grantSnapBadge("SEEKER", seekerId, seekerSnapIds[0]);
      }
    }
    for (const r of approvedRetainers) {
      const retainerId = String((r as any).id);
      setActiveBadges("RETAINER", retainerId, pickSome(retainerSelectableIds, 1, 2));
      setBackgroundBadges("RETAINER", retainerId, pickSome(retainerBackgroundIds, 4, 4), { allowOverride: true });
      if (retainerSnapIds.length > 0) {
        grantSnapBadge("RETAINER", retainerId, retainerSnapIds[0]);
      }
    }

    for (const ms of msSeekers) {
      const seekerId = String(ms.seekerId);
      setActiveBadges("SEEKER", seekerId, pickSome(seekerSelectableIds, 3, 4));
      setBackgroundBadges("SEEKER", seekerId, pickSome(seekerBackgroundIds, 4, 4), { allowOverride: true });
      if (seekerSnapIds.length > 0) {
        grantSnapBadge("SEEKER", seekerId, seekerSnapIds[0]);
      }
    }
    for (const mr of msRetainers) {
      const retainerId = String(mr.retainerId);
      setActiveBadges("RETAINER", retainerId, pickSome(retainerSelectableIds, 3, 4));
      setBackgroundBadges("RETAINER", retainerId, pickSome(retainerBackgroundIds, 4, 4), { allowOverride: true });
      if (retainerSnapIds.length > 0) {
        grantSnapBadge("RETAINER", retainerId, retainerSnapIds[0]);
      }
    }

    function isoWeekKeyForDate(date: Date): string {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    }

    function monthKeyForDate(date: Date): string {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    }

    const msSeekerIds = msSeekers.map((s) => String(s.seekerId));
    const msRetainerIds = msRetainers.map((r) => String(r.retainerId));
    const badgeCheckins: SubmitWeeklyCheckinArgs[] = [];

    // Create light badge progress for a subset of linked, approved profiles.
    if (seededLinks.length > 0) {
      for (const link of seededLinks) {
        const seekerId = String(link.seekerId);
        const retainerId = String(link.retainerId);

        if (msSeekerIds.includes(seekerId) && msRetainerIds.includes(retainerId)) {
          continue;
        }

        if (randomInt(0, 9) < 4) continue;

        setWorkingTogether({ seekerId, retainerId, by: "SEEKER", value: true });
        setWorkingTogether({ seekerId, retainerId, by: "RETAINER", value: true });

        const seekerActive = getActiveBadges("SEEKER", seekerId);
        const retainerActive = getActiveBadges("RETAINER", retainerId);
        const seekerBackground = getSelectedBackgroundBadges("SEEKER", seekerId);
        const retainerBackground = getSelectedBackgroundBadges("RETAINER", retainerId);
        const seekerPool = Array.from(new Set([...seekerBackground, ...seekerActive]));
        const retainerPool = Array.from(new Set([...retainerBackground, ...retainerActive]));
        const seekerBadgeSample = seekerPool.slice(0, Math.min(2, seekerPool.length));
        const retainerBadgeSample = retainerPool.slice(0, Math.min(2, retainerPool.length));
        if (seekerBadgeSample.length === 0 && retainerBadgeSample.length === 0) continue;

        const historyWeeks = randomInt(4, 12);
        const yesThreshold = randomInt(6, 9);
        for (let w = historyWeeks - 1; w >= 0; w--) {
          const dt = new Date();
          dt.setDate(dt.getDate() - w * 7);
          const weekKey = isoWeekKeyForDate(dt);
          const dtIso = dt.toISOString();

          for (const badgeId of seekerBadgeSample) {
            badgeCheckins.push({
              badgeId,
              weekKey,
              cadence: "WEEKLY",
              value: randomInt(0, 9) < yesThreshold ? "YES" : "NO",
              seekerId,
              retainerId,
              targetRole: "SEEKER",
              targetId: seekerId,
              verifierRole: "RETAINER",
              verifierId: retainerId,
              createdAt: dtIso,
              updatedAt: dtIso,
            });
          }

          for (const badgeId of retainerBadgeSample) {
            badgeCheckins.push({
              badgeId,
              weekKey,
              cadence: "WEEKLY",
              value: randomInt(0, 9) < yesThreshold ? "YES" : "NO",
              seekerId,
              retainerId,
              targetRole: "RETAINER",
              targetId: retainerId,
              verifierRole: "SEEKER",
              verifierId: seekerId,
              createdAt: dtIso,
              updatedAt: dtIso,
            });
          }
        }
        const historyMonths = randomInt(2, 6);
        const monthYesThreshold = randomInt(7, 9);
        for (let m = historyMonths - 1; m >= 0; m--) {
          const dt = new Date();
          dt.setMonth(dt.getMonth() - m);
          const periodKey = monthKeyForDate(dt);
          const dtIso = dt.toISOString();

          for (const badgeId of seekerCheckerIds) {
            badgeCheckins.push({
              badgeId,
              weekKey: periodKey,
              cadence: "MONTHLY",
              value: randomInt(0, 9) < monthYesThreshold ? "YES" : "NO",
              seekerId,
              retainerId,
              targetRole: "SEEKER",
              targetId: seekerId,
              verifierRole: "RETAINER",
              verifierId: retainerId,
              createdAt: dtIso,
              updatedAt: dtIso,
            });
          }

          for (const badgeId of retainerCheckerIds) {
            badgeCheckins.push({
              badgeId,
              weekKey: periodKey,
              cadence: "MONTHLY",
              value: randomInt(0, 9) < monthYesThreshold ? "YES" : "NO",
              seekerId,
              retainerId,
              targetRole: "RETAINER",
              targetId: retainerId,
              verifierRole: "SEEKER",
              verifierId: seekerId,
              createdAt: dtIso,
              updatedAt: dtIso,
            });
          }
        }
      }
    }

    // Create badge history on a subset of MS links, with varied progress levels.
    for (let si = 0; si < msSeekerIds.length; si++) {
      const seekerId = msSeekerIds[si];
      for (let ri = 0; ri < Math.min(3, msRetainerIds.length); ri++) {
        const retainerId = msRetainerIds[ri];

        // Mix: some links are "almost working", some fully active.
        const fullyWorking = randomInt(0, 9) < 6; // ~60%
        setWorkingTogether({ seekerId, retainerId, by: "SEEKER", value: true });
        setWorkingTogether({ seekerId, retainerId, by: "RETAINER", value: fullyWorking });

        if (!fullyWorking) continue;

        const seekerActive = getActiveBadges("SEEKER", seekerId);
        const retainerActive = getActiveBadges("RETAINER", retainerId);
        const seekerBackground = getSelectedBackgroundBadges("SEEKER", seekerId);
        const retainerBackground = getSelectedBackgroundBadges("RETAINER", retainerId);
        const seekerPool = Array.from(new Set([...seekerBackground, ...seekerActive]));
        const retainerPool = Array.from(new Set([...retainerBackground, ...retainerActive]));

        const historyWeeks =
          si === 0 && ri === 0 ? 64 : randomInt(6, 22); // one very mature relationship

        for (let w = historyWeeks - 1; w >= 0; w--) {
          const dt = new Date();
          dt.setDate(dt.getDate() - w * 7);
          const weekKey = isoWeekKeyForDate(dt);
          const dtIso = dt.toISOString();

          const seekerBadgeSample = seekerPool.slice(0, Math.min(2, seekerPool.length));
          const retainerBadgeSample = retainerPool.slice(0, Math.min(2, retainerPool.length));

          for (const badgeId of seekerBadgeSample) {
            badgeCheckins.push({
              badgeId,
              weekKey,
              cadence: "WEEKLY",
              value: randomInt(0, 9) < 8 ? "YES" : "NO",
              seekerId,
              retainerId,
              targetRole: "SEEKER",
              targetId: seekerId,
              verifierRole: "RETAINER",
              verifierId: retainerId,
              createdAt: dtIso,
              updatedAt: dtIso,
            });
          }

          for (const badgeId of retainerBadgeSample) {
            badgeCheckins.push({
              badgeId,
              weekKey,
              cadence: "WEEKLY",
              value: randomInt(0, 9) < 8 ? "YES" : "NO",
              seekerId,
              retainerId,
              targetRole: "RETAINER",
              targetId: retainerId,
              verifierRole: "SEEKER",
              verifierId: seekerId,
              createdAt: dtIso,
              updatedAt: dtIso,
            });
          }
        }

        const historyMonths = si === 0 && ri === 0 ? 10 : randomInt(3, 8);
        for (let m = historyMonths - 1; m >= 0; m--) {
          const dt = new Date();
          dt.setMonth(dt.getMonth() - m);
          const periodKey = monthKeyForDate(dt);
          const dtIso = dt.toISOString();

          for (const badgeId of seekerCheckerIds) {
            badgeCheckins.push({
              badgeId,
              weekKey: periodKey,
              cadence: "MONTHLY",
              value: randomInt(0, 9) < 8 ? "YES" : "NO",
              seekerId,
              retainerId,
              targetRole: "SEEKER",
              targetId: seekerId,
              verifierRole: "RETAINER",
              verifierId: retainerId,
              createdAt: dtIso,
              updatedAt: dtIso,
            });
          }

          for (const badgeId of retainerCheckerIds) {
            badgeCheckins.push({
              badgeId,
              weekKey: periodKey,
              cadence: "MONTHLY",
              value: randomInt(0, 9) < 8 ? "YES" : "NO",
              seekerId,
              retainerId,
              targetRole: "RETAINER",
              targetId: retainerId,
              verifierRole: "SEEKER",
              verifierId: seekerId,
              createdAt: dtIso,
              updatedAt: dtIso,
            });
          }
        }
      }
    }
    if (badgeCheckins.length > 0) {
      submitWeeklyCheckinsBatch(badgeCheckins);
    }
    clearSeedScoreHistory();

    const historyDates = buildHistoryDates(180, [14]);
    const seedHistory = (ownerRole: "SEEKER" | "RETAINER", ownerId: string) => {
      historyDates.forEach((dt) => {
        const score = computeSeedScoreForProfileAtDate({
          ownerRole,
          ownerId,
          asOf: dt,
        });
        addReputationScoreHistoryEntry({
          ownerRole,
          ownerId,
          score: score ?? clampReputationScoreValue(REPUTATION_SCORE_MIN + 200),
          createdAt: dt.toISOString(),
          note: "Seeded 14-day score history",
        });
      });
    };

    for (const s of approvedSeekers) {
      seedHistory("SEEKER", String((s as any).id));
    }
    for (const r of approvedRetainers) {
      seedHistory("RETAINER", String((r as any).id));
    }

  } catch {
    // best-effort
  }

  setSeedModeEnabled(true);
}
