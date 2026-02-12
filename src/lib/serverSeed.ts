// src/lib/serverSeed.ts
import { getRetainers, getSeekers } from "./data";
import { getAllLinks } from "./linking";
import { getAllConversations, getAllMessages } from "./messages";
import { getAllRoutes, getAllRouteInterests } from "./routes";
import { getAllRetainerPosts } from "./posts";
import { getAllRetainerBroadcasts } from "./broadcasts";
import { getAllMeetings } from "./meetings";
import { getRouteAssignments, getWorkUnitPeriods } from "./workUnits";
import {
  getBadgeCheckins,
  getBadgeDefinitions,
  getBadgeSelections,
  getReputationScoreHistoryEntries,
  reputationScoreToPercent,
  type BadgeSelection,
  type BadgeCheckin,
} from "./badges";

export type ServerSeedPayload = {
  batchId: string;
  seekers?: any[];
  retainers?: any[];
  retainerUsers?: any[];
  subcontractors?: any[];
  links?: any[];
  conversations?: any[];
  messages?: any[];
  routes?: any[];
  routeInterests?: any[];
  routeAssignments?: any[];
  workUnitPeriods?: any[];
  posts?: any[];
  broadcasts?: any[];
  meetings?: any[];
  badgeDefinitions?: any[];
  badgeSelections?: any[];
  badgeCheckins?: any[];
  reputationScores?: any[];
  recordHallEntries?: any[];
};

type SeedSummary = {
  seekers: number;
  retainers: number;
  retainerUsers: number;
  subcontractors: number;
  links: number;
  conversations: number;
  messages: number;
  routes: number;
  routeInterests: number;
  posts: number;
  broadcasts: number;
  meetings: number;
  badgeDefinitions: number;
  badgeSelections: number;
  badgeCheckins: number;
  reputationScores: number;
};

function toIso(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function flattenBadgeSelections(selections: BadgeSelection[]) {
  const rows: any[] = [];
  for (const sel of selections) {
    const ownerRole = sel.ownerRole;
    const ownerId = sel.ownerId;
    for (const badgeId of sel.activeBadgeIds ?? []) {
      rows.push({
        ownerRole,
        ownerId,
        badgeId,
        kind: "FOREGROUND",
        isActive: true,
        lockedUntil: null,
        updatedAt: sel.updatedAt,
      });
    }
    for (const badgeId of sel.backgroundBadgeIds ?? []) {
      rows.push({
        ownerRole,
        ownerId,
        badgeId,
        kind: "BACKGROUND",
        isActive: true,
        lockedUntil: sel.backgroundLockedUntil ?? null,
        updatedAt: sel.updatedAt,
      });
    }
  }
  return rows;
}

function mapCheckins(checkins: BadgeCheckin[]) {
  return checkins.map((checkin) => ({
    ...checkin,
    ownerRole: checkin.targetRole,
    ownerId: checkin.targetId,
    targetRole: checkin.verifierRole,
    targetId: checkin.verifierId,
    value: checkin.overrideValue ?? checkin.value,
    status: checkin.status ?? "ACTIVE",
    createdAt: checkin.createdAt,
  }));
}

export function buildServerSeedPayload(batchId: string): ServerSeedPayload {
  const seekers = getSeekers();
  const retainers = getRetainers();
  const links = getAllLinks();
  const conversations = getAllConversations();
  const routes = getAllRoutes();
  const routeInterests = getAllRouteInterests();
  const routeAssignments = getRouteAssignments();
  const workUnitPeriods = getWorkUnitPeriods();
  const posts = getAllRetainerPosts();
  const broadcasts = getAllRetainerBroadcasts();
  const meetings = getAllMeetings();
  const badgeDefinitions = [
    ...getBadgeDefinitions("SEEKER"),
    ...getBadgeDefinitions("RETAINER"),
  ].map((def) => ({
    ...def,
    role: def.ownerRole,
  }));
  const badgeSelections = flattenBadgeSelections(getBadgeSelections());
  const badgeCheckins = mapCheckins(getBadgeCheckins());

  const retainerUsers = retainers.flatMap((retainer) =>
    (retainer.users ?? []).map((user) => ({
      ...user,
      retainerId: retainer.id,
      createdAt: toIso(user.createdAt) ?? new Date().toISOString(),
    }))
  );

  const subcontractors = seekers.flatMap((seeker) =>
    (seeker.subcontractors ?? []).map((sub) => ({
      ...sub,
      seekerId: seeker.id,
      createdAt: toIso(sub.createdAt) ?? new Date().toISOString(),
    }))
  );

  const conversationsById = new Map(conversations.map((c) => [c.id, c]));
  const messages = getAllMessages()
    .map((msg) => {
      const conv = conversationsById.get(msg.conversationId);
      if (!conv) return null;
      const senderId =
        msg.senderRole === "SEEKER"
          ? conv.seekerId
          : msg.senderRole === "RETAINER"
            ? conv.retainerId
            : "admin";
      if (!senderId) return null;
      return {
        ...msg,
        senderId,
      };
    })
    .filter(Boolean) as any[];

  const reputationScores = getReputationScoreHistoryEntries().map((entry) => ({
    ...entry,
    scorePercent: reputationScoreToPercent(entry.score),
  }));

  return {
    batchId,
    seekers,
    retainers,
    retainerUsers,
    subcontractors,
    links,
    conversations,
    messages,
    routes,
    routeInterests,
    routeAssignments,
    workUnitPeriods,
    posts,
    broadcasts,
    meetings,
    badgeDefinitions,
    badgeSelections,
    badgeCheckins,
    reputationScores,
    recordHallEntries: [],
  };
}

export function getLocalSeedSummary(): SeedSummary {
  const seekers = getSeekers();
  const retainers = getRetainers();
  const links = getAllLinks();
  const conversations = getAllConversations();
  const routes = getAllRoutes();
  const routeInterests = getAllRouteInterests();
  const posts = getAllRetainerPosts();
  const broadcasts = getAllRetainerBroadcasts();
  const meetings = getAllMeetings();
  const badgeDefinitions =
    getBadgeDefinitions("SEEKER").length + getBadgeDefinitions("RETAINER").length;
  const badgeSelections = getBadgeSelections().reduce(
    (count, sel) =>
      count + (sel.activeBadgeIds?.length ?? 0) + (sel.backgroundBadgeIds?.length ?? 0),
    0
  );
  const badgeCheckins = getBadgeCheckins().length;
  const reputationScores = getReputationScoreHistoryEntries().length;

  const retainerUsers = retainers.reduce(
    (count, retainer) => count + (retainer.users?.length ?? 0),
    0
  );
  const subcontractors = seekers.reduce(
    (count, seeker) => count + (seeker.subcontractors?.length ?? 0),
    0
  );
  const messages = getAllMessages().length;

  return {
    seekers: seekers.length,
    retainers: retainers.length,
    retainerUsers,
    subcontractors,
    links: links.length,
    conversations: conversations.length,
    messages,
    routes: routes.length,
    routeInterests: routeInterests.length,
    posts: posts.length,
    broadcasts: broadcasts.length,
    meetings: meetings.length,
    badgeDefinitions,
    badgeSelections,
    badgeCheckins,
    reputationScores,
  };
}
