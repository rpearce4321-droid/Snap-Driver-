import { syncPull, syncUpsert } from "./api";
import { readStoreData, writeStore, setStoreListener } from "./storage";
import { getSeekers, getRetainers, notifyDataUpdated } from "./data";
import { getAllLinks } from "./linking";
import { getAllConversations, getAllMessages } from "./messages";
import { getAllRoutes, getAllRouteInterests } from "./routes";
import { getAllRetainerPosts } from "./posts";
import { getAllRetainerBroadcasts } from "./broadcasts";
import {
  computeBadgeLevelFromCounts,
  getBadgeCheckins,
  getBadgeDefinitions,
  getBadgeRulesSnapshot,
  getBadgeScoreSnapshot,
  getBadgeSelections,
  getReputationScoreHistoryEntries,
  reputationScoreToPercent,
  type BadgeCheckin,
  type BadgeDefinition,
  type BadgeOwnerRole,
  type BadgeSelection,
} from "./badges";

const SERVER_SYNC_ENABLED_KEY = "snapdriver_server_sync_enabled";
const SEED_MODE_KEY = "snapdriver_seed_mode";

const CURRENT_SEEKER_KEY = "snapdriver_current_seeker_id";
const CURRENT_RETAINER_KEY = "snapdriver_current_retainer_id";

const KEY_SEEKERS = "demo_seekers_v2";
const KEY_RETAINERS = "demo_retainers_v2";
const KEY_LINKS = "snapdriver_links_v1";
const KEY_CONVERSATIONS = "snapdriver_conversations_v1";
const KEY_MESSAGES = "snapdriver_messages_v1";
const KEY_ROUTES = "snapdriver_routes_v1";
const KEY_ROUTE_INTERESTS = "snapdriver_route_interests_v1";
const KEY_POSTS = "snapdriver_retainer_posts_v1";
const KEY_BROADCASTS = "snapdriver_retainer_broadcasts_v1";
const KEY_BADGES = "snapdriver_badges_v2";
const KEY_BADGE_RULES = "snapdriver_badge_rules_v1";
const KEY_BADGE_SCORE = "snapdriver_badge_scoring_v1";
const KEY_BADGE_SCORE_HISTORY = "snapdriver_reputation_history_v1";

let muted = false;
let syncTimer: number | undefined;
let syncInFlight = false;
type SyncEvent = { type: "pull" | "push"; at: string };
let syncListener: ((event: SyncEvent) => void) | null = null;

export function setSyncListener(listener: ((event: SyncEvent) => void) | null): void {
  syncListener = listener;
}

function notifySync(event: SyncEvent) {
  if (syncListener) syncListener(event);
}

function setLocalFlag(key: string, value: boolean) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
}

function getLocalFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function isSeedModeEnabled(): boolean {
  return getLocalFlag(SEED_MODE_KEY);
}

export function setSeedModeEnabled(next: boolean): void {
  setLocalFlag(SEED_MODE_KEY, next);
}

export function isServerSyncEnabled(): boolean {
  return getLocalFlag(SERVER_SYNC_ENABLED_KEY);
}

export function setServerSyncEnabled(next: boolean): void {
  setLocalFlag(SERVER_SYNC_ENABLED_KEY, next);
}

export function setServerSyncMuted(next: boolean): void {
  muted = next;
}

function shouldSyncKey(key: string): boolean {
  return [
    KEY_SEEKERS,
    KEY_RETAINERS,
    KEY_LINKS,
    KEY_CONVERSATIONS,
    KEY_MESSAGES,
    KEY_ROUTES,
    KEY_ROUTE_INTERESTS,
    KEY_POSTS,
    KEY_BROADCASTS,
    KEY_BADGES,
    KEY_BADGE_RULES,
    KEY_BADGE_SCORE,
    KEY_BADGE_SCORE_HISTORY,
  ].includes(key);
}

export function queueServerSync(key?: string): void {
  if (typeof window === "undefined") return;
  if (muted) return;
  if (!isServerSyncEnabled()) return;
  if (key && !shouldSyncKey(key)) return;
  if (syncTimer) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = undefined;
    syncToServer().catch(() => undefined);
  }, 1200);
}

function toIso(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt.toISOString();
}

function markSeed(item: any) {
  if (!isSeedModeEnabled()) return item;
  return { ...item, __seed: true };
}

function flattenBadgeSelections(selections: BadgeSelection[]) {
  const rows: any[] = [];
  for (const sel of selections) {
    const ownerRole = sel.ownerRole;
    const ownerId = sel.ownerId;
    for (const badgeId of sel.activeBadgeIds ?? []) {
      rows.push(markSeed({
        ownerRole,
        ownerId,
        badgeId,
        kind: "FOREGROUND",
        isActive: true,
        lockedUntil: null,
        updatedAt: sel.updatedAt,
      }));
    }
    for (const badgeId of sel.backgroundBadgeIds ?? []) {
      rows.push(markSeed({
        ownerRole,
        ownerId,
        badgeId,
        kind: "BACKGROUND",
        isActive: true,
        lockedUntil: sel.backgroundLockedUntil ?? null,
        updatedAt: sel.updatedAt,
      }));
    }
  }
  return rows;
}

function mapCheckins(checkins: BadgeCheckin[]) {
  return checkins.map((checkin) =>
    markSeed({
      ...checkin,
      ownerRole: checkin.targetRole,
      ownerId: checkin.targetId,
      targetRole: checkin.verifierRole,
      targetId: checkin.verifierId,
      value: checkin.overrideValue ?? checkin.value,
      status: checkin.status ?? "ACTIVE",
      createdAt: checkin.createdAt,
    })
  );
}

export async function syncToServer(): Promise<void> {
  if (syncInFlight) return;
  syncInFlight = true;
  try {
    const seekers = getSeekers().map((s) => markSeed(s));
    const retainers = getRetainers().map((r) => markSeed(r));

    const retainerUsers = retainers.flatMap((retainer) =>
      (retainer.users ?? []).map((user: any) =>
        markSeed({
          ...user,
          retainerId: retainer.id,
          createdAt: toIso(user.createdAt) ?? new Date().toISOString(),
        })
      )
    );

    const subcontractors = seekers.flatMap((seeker) =>
      (seeker.subcontractors ?? []).map((sub: any) =>
        markSeed({
          ...sub,
          seekerId: seeker.id,
          createdAt: toIso(sub.createdAt) ?? new Date().toISOString(),
        })
      )
    );

    const links = getAllLinks().map((l) => markSeed(l));
    const conversations = getAllConversations().map((c) => markSeed(c));

    const conversationById = new Map(conversations.map((c) => [c.id, c]));
    const messages = getAllMessages()
      .map((msg) => {
        const conv = conversationById.get(msg.conversationId);
        if (!conv) return null;
        const senderId =
          msg.senderRole === "SEEKER"
            ? conv.seekerId
            : msg.senderRole === "RETAINER"
              ? conv.retainerId
              : "admin";
        return markSeed({ ...msg, senderId });
      })
      .filter(Boolean) as any[];

    const routes = getAllRoutes().map((r) => markSeed(r));
    const routeInterests = getAllRouteInterests().map((ri) => markSeed(ri));
    const posts = getAllRetainerPosts().map((p) => markSeed(p));
    const broadcasts = getAllRetainerBroadcasts().map((b) => markSeed(b));

    const badgeDefinitions: BadgeDefinition[] = [
      ...getBadgeDefinitions("SEEKER"),
      ...getBadgeDefinitions("RETAINER"),
    ].map((def) => markSeed(def));

    const badgeSelections = flattenBadgeSelections(getBadgeSelections());
    const badgeCheckins = mapCheckins(getBadgeCheckins());
    const reputationScores = getReputationScoreHistoryEntries().map((entry) =>
      markSeed({
        ...entry,
        scorePercent: reputationScoreToPercent(entry.score),
      })
    );
    const systemSettings = [
      { key: "badge_rules", value: JSON.stringify(getBadgeRulesSnapshot()) },
      { key: "badge_score", value: JSON.stringify(getBadgeScoreSnapshot()) },
    ];

    await syncUpsert({
      seekers,
      retainers,
      retainerUsers,
      subcontractors,
      links,
      conversations,
      messages,
      routes,
      routeInterests,
      posts,
      broadcasts,
      badgeDefinitions,
      badgeSelections,
      badgeCheckins,
      reputationScores,
      recordHallEntries: [],
      systemSettings,
    });
    notifySync({ type: "push", at: new Date().toISOString() });
  } finally {
    syncInFlight = false;
  }
}

function buildBadgeStoreFromRows(args: {
  selections: any[];
  checkins: any[];
}): { selections: any[]; progress: any[]; checkins: any[] } {
  const rawSelections = args.selections ?? [];
  const checkins = args.checkins ?? [];

  const selectionMap = new Map<string, BadgeSelection>();
  for (const row of rawSelections) {
    const ownerRole = row.ownerRole || row.owner_role || "SEEKER";
    const ownerId = row.ownerId || row.owner_id;
    if (!ownerId) continue;
    const key = `${ownerRole}:${ownerId}`;
    const existing: BadgeSelection = selectionMap.get(key) ?? {
      ownerRole,
      ownerId,
      activeBadgeIds: [],
      backgroundBadgeIds: [],
      backgroundLockedUntil: null,
      updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
    };

    const kind = String(row.kind || "FOREGROUND").toUpperCase();
    const badgeId = row.badgeId || row.badge_id;
    if (badgeId) {
      if (kind === "BACKGROUND") {
        if (!existing.backgroundBadgeIds.includes(badgeId)) {
          existing.backgroundBadgeIds.push(badgeId);
        }
        if (row.lockedUntil || row.locked_until) {
          existing.backgroundLockedUntil = row.lockedUntil || row.locked_until;
        }
      } else {
        if (!existing.activeBadgeIds.includes(badgeId)) {
          existing.activeBadgeIds.push(badgeId);
        }
      }
    }

    existing.updatedAt = row.updatedAt || row.updated_at || existing.updatedAt;
    selectionMap.set(key, existing);
  }

  const selections = Array.from(selectionMap.values());
  const progressMap = new Map<string, { yes: number; no: number }>();

  const countKey = (ownerRole: BadgeOwnerRole, ownerId: string, badgeId: string) =>
    `${ownerRole}:${ownerId}:${badgeId}`;

  for (const c of checkins) {
    const status = c.status ?? "ACTIVE";
    if (status === "DISPUTED") continue;
    const value = c.overrideValue ?? c.value;
    if (value !== "YES" && value !== "NO") continue;
    const key = countKey(c.targetRole ?? c.ownerRole, c.targetId ?? c.ownerId, c.badgeId);
    const current = progressMap.get(key) ?? { yes: 0, no: 0 };
    if (value === "YES") current.yes += 1;
    else current.no += 1;
    progressMap.set(key, current);
  }

  const progress = Array.from(progressMap.entries()).map(([key, counts]) => {
    const [ownerRole, ownerId, badgeId] = key.split(":");
    return {
      badgeId,
      ownerRole,
      ownerId,
      yesCount: counts.yes,
      noCount: counts.no,
      maxLevel: computeBadgeLevelFromCounts(badgeId, counts.yes, counts.no),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  return { selections, progress, checkins };
}
export async function pullFromServer(): Promise<boolean> {
  try {
    const data = await syncPull();

    setServerSyncMuted(true);

    const seekers = data.seekers ?? [];
    const retainers = data.retainers ?? [];
    const previousSeekers = readStoreData<any[]>(KEY_SEEKERS) ?? [];
    const previousRetainers = readStoreData<any[]>(KEY_RETAINERS) ?? [];
    const currentSeekerId = typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_SEEKER_KEY) : null;
    const currentRetainerId = typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_RETAINER_KEY) : null;
    const retainerUsers = data.retainerUsers ?? [];
    const subcontractors = data.subcontractors ?? [];

    const retainerUsersByRetainer = new Map<string, any[]>();
    for (const user of retainerUsers) {
      const list = retainerUsersByRetainer.get(user.retainerId) ?? [];
      list.push(user);
      retainerUsersByRetainer.set(user.retainerId, list);
    }

    const subsBySeeker = new Map<string, any[]>();
    for (const sub of subcontractors) {
      const list = subsBySeeker.get(sub.seekerId) ?? [];
      list.push(sub);
      subsBySeeker.set(sub.seekerId, list);
    }

    let nextRetainers = retainers.map((r: any) => ({
      ...r,
      users: retainerUsersByRetainer.get(r.id) ?? r.users,
    }));
    let nextSeekers = seekers.map((s: any) => ({
      ...s,
      subcontractors: subsBySeeker.get(s.id) ?? s.subcontractors,
    }));


    if (currentSeekerId && !nextSeekers.some((s: any) => s.id === currentSeekerId)) {
      const fallbackSeeker = previousSeekers.find((s: any) => s.id === currentSeekerId);
      if (fallbackSeeker) {
        nextSeekers = [fallbackSeeker, ...nextSeekers];
      }
    }
    if (currentRetainerId && !nextRetainers.some((r: any) => r.id === currentRetainerId)) {
      const fallbackRetainer = previousRetainers.find((r: any) => r.id === currentRetainerId);
      if (fallbackRetainer) {
        nextRetainers = [fallbackRetainer, ...nextRetainers];
      }
    }
    writeStore(KEY_SEEKERS, 1, nextSeekers);
    writeStore(KEY_RETAINERS, 1, nextRetainers);
    writeStore(KEY_LINKS, 1, data.links ?? []);
    writeStore(KEY_CONVERSATIONS, 1, data.conversations ?? []);
    writeStore(KEY_MESSAGES, 1, data.messages ?? []);
    writeStore(KEY_ROUTES, 1, data.routes ?? []);
    writeStore(KEY_ROUTE_INTERESTS, 1, data.routeInterests ?? []);
    writeStore(KEY_POSTS, 1, data.posts ?? []);
    writeStore(KEY_BROADCASTS, 1, data.broadcasts ?? []);

    const seedPresent = [
      ...(data.seekers ?? []),
      ...(data.retainers ?? []),
      ...(data.links ?? []),
      ...(data.conversations ?? []),
      ...(data.messages ?? []),
      ...(data.routes ?? []),
      ...(data.routeInterests ?? []),
      ...(data.posts ?? []),
      ...(data.broadcasts ?? []),
      ...(data.badgeDefinitions ?? []),
      ...(data.badgeSelections ?? []),
      ...(data.badgeCheckins ?? []),
      ...(data.reputationScores ?? []),
    ].some((item: any) => item?.__seed);
    if (seedPresent) {
      setSeedModeEnabled(true);
    }

    const badgeStore = buildBadgeStoreFromRows({
      selections: data.badgeSelections ?? [],
      checkins: data.badgeCheckins ?? [],
    });
    writeStore(KEY_BADGES, 3, badgeStore);

    writeStore(KEY_BADGE_SCORE_HISTORY, 1, data.reputationScores ?? []);

    const settings = data.systemSettings ?? [];
    for (const setting of settings) {
      if (!setting?.key) continue;
      if (setting.key === "badge_rules") {
        try {
          const parsed = JSON.parse(setting.value ?? "{}");
          writeStore(KEY_BADGE_RULES, 1, parsed);
        } catch {
          // ignore invalid settings
        }
      }
      if (setting.key === "badge_score") {
        try {
          const parsed = JSON.parse(setting.value ?? "{}");
          writeStore(KEY_BADGE_SCORE, 1, parsed);
        } catch {
          // ignore invalid settings
        }
      }
    }

    notifyDataUpdated();

    notifySync({ type: "pull", at: new Date().toISOString() });

    setServerSyncMuted(false);
    return true;
  } catch {
    setServerSyncMuted(false);
    return false;
  }
}

export async function initServerSync(): Promise<void> {
  setServerSyncEnabled(true);
  setStoreListener((key) => queueServerSync(key));
  if (typeof window === "undefined") return;
  try {
    await pullFromServer();
    setServerSyncEnabled(true);
  } catch {
    // ignore
  }
}

export function getServerSyncStatus(): { enabled: boolean; seedMode: boolean } {
  return { enabled: isServerSyncEnabled(), seedMode: isSeedModeEnabled() };
}


















