// src/lib/linking.ts
//
// Local-first linking state machine between a Seeker and a Retainer.
// Linking is a post-video relationship that unlocks linked-only feed content.
//
// Non-negotiables (see docs/CONTEXT.md):
// - Requires both parties approve.
// - Manual video-confirmation toggles for each party.

import { readStoreData, writeStore } from "./storage";
import { canSeekerLink } from "./entitlements";

export type LinkStatus = "PENDING" | "ACTIVE" | "REJECTED" | "DISABLED";

export type LinkMeetingProposal = {
  id: string;
  startAt: string; // ISO
  durationMinutes: number; // UI offers 10/20/30
  by: "SEEKER" | "RETAINER";
  note?: string;
  createdAt: string;
};

export type Link = {
  id: string;
  seekerId: string;
  retainerId: string;

  requestedBySeeker: boolean;
  requestedByRetainer: boolean;

  videoConfirmedBySeeker: boolean;
  videoConfirmedByRetainer: boolean;

  approvedBySeeker: boolean;
  approvedByRetainer: boolean;

  // Post-link relationship state. Only used when link.status === "ACTIVE".
  // Effective "working together" is true only when both parties have toggled it on.
  workingTogetherBySeeker: boolean;
  workingTogetherByRetainer: boolean;

  meetingProposals: LinkMeetingProposal[];
  meetingAcceptedProposalId?: string | null;
  meetingAcceptedAt?: string | null;

  status: LinkStatus;
  createdAt: string;
  updatedAt: string;
};

const KEY = "snapdriver_links_v1";
const SCHEMA_VERSION = 1;

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

function normalizeProposal(p: any): LinkMeetingProposal | null {
  if (!p || typeof p !== "object") return null;
  if (!p.startAt) return null;

  const by: "SEEKER" | "RETAINER" =
    p.by === "RETAINER" ? "RETAINER" : "SEEKER";

  const durationMinutesRaw =
    typeof p.durationMinutes === "number"
      ? p.durationMinutes
      : Number(p.durationMinutes);
  const durationMinutes = Number.isFinite(durationMinutesRaw)
    ? Math.max(5, Math.min(120, Math.round(durationMinutesRaw)))
    : 20;

  return {
    id: String(p.id || makeId("meet")),
    startAt: String(p.startAt),
    durationMinutes,
    by,
    note: typeof p.note === "string" && p.note.trim() ? p.note.trim() : undefined,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : nowIso(),
  };
}

function normalize(link: any): Link | null {
  if (!link || typeof link !== "object") return null;
  if (!link.seekerId || !link.retainerId) return null;

  const status: LinkStatus =
    link.status === "ACTIVE" ||
    link.status === "REJECTED" ||
    link.status === "DISABLED"
      ? link.status
      : "PENDING";

  return {
    id: String(link.id || makeId("link")),
    seekerId: String(link.seekerId),
    retainerId: String(link.retainerId),

    requestedBySeeker: Boolean(link.requestedBySeeker),
    requestedByRetainer: Boolean(link.requestedByRetainer),

    videoConfirmedBySeeker: Boolean(link.videoConfirmedBySeeker),
    videoConfirmedByRetainer: Boolean(link.videoConfirmedByRetainer),

    approvedBySeeker: Boolean(link.approvedBySeeker),
    approvedByRetainer: Boolean(link.approvedByRetainer),

    workingTogetherBySeeker: Boolean(link.workingTogetherBySeeker),
    workingTogetherByRetainer: Boolean(link.workingTogetherByRetainer),

    meetingProposals: Array.isArray(link.meetingProposals)
      ? (link.meetingProposals as any[])
          .map(normalizeProposal)
          .filter((x): x is LinkMeetingProposal => x !== null)
      : [],
    meetingAcceptedProposalId:
      typeof link.meetingAcceptedProposalId === "string"
        ? link.meetingAcceptedProposalId
        : null,
    meetingAcceptedAt:
      typeof link.meetingAcceptedAt === "string" ? link.meetingAcceptedAt : null,

    status,
    createdAt: typeof link.createdAt === "string" ? link.createdAt : nowIso(),
    updatedAt: typeof link.updatedAt === "string" ? link.updatedAt : nowIso(),
  };
}

function computeStatus(link: Link): LinkStatus {
  if (link.status === "REJECTED" || link.status === "DISABLED") return link.status;
  const active =
    link.videoConfirmedBySeeker &&
    link.videoConfirmedByRetainer &&
    link.approvedBySeeker &&
    link.approvedByRetainer;
  return active ? "ACTIVE" : "PENDING";
}

function loadAll(): Link[] {
  const parsed = readStoreData<unknown>(KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[])
    .map(normalize)
    .filter((x): x is Link => x !== null);
}

function saveAll(list: Link[]) {
  writeStore(KEY, SCHEMA_VERSION, list);
}

function assertSeekerCanLink(seekerId: string) {
  const access = canSeekerLink(seekerId);
  if (!access.ok) {
    throw new Error(access.reason || "Paid seeker tier required to link.");
  }
}

export function getAllLinks(): Link[] {
  return loadAll().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getLink(seekerId: string, retainerId: string): Link | null {
  if (!seekerId || !retainerId) return null;
  return (
    loadAll().find((l) => l.seekerId === seekerId && l.retainerId === retainerId) ??
    null
  );
}

export function getLinksForSeeker(seekerId: string): Link[] {
  if (!seekerId) return [];
  return getAllLinks().filter((l) => l.seekerId === seekerId);
}

export function getLinksForRetainer(retainerId: string): Link[] {
  if (!retainerId) return [];
  return getAllLinks().filter((l) => l.retainerId === retainerId);
}

export function requestLink(args: {
  seekerId: string;
  retainerId: string;
  by: "SEEKER" | "RETAINER";
}): Link {
  const { seekerId, retainerId } = args;
  if (!seekerId || !retainerId) throw new Error("seekerId and retainerId are required");
  assertSeekerCanLink(seekerId);

  const all = loadAll();
  const existingIdx = all.findIndex((l) => l.seekerId === seekerId && l.retainerId === retainerId);
  const ts = nowIso();

  if (existingIdx >= 0) {
    const existing = all[existingIdx];
    const next: Link = {
      ...existing,
      requestedBySeeker: existing.requestedBySeeker || args.by === "SEEKER",
      requestedByRetainer: existing.requestedByRetainer || args.by === "RETAINER",
      updatedAt: ts,
    };
    const normalized: Link = { ...next, status: computeStatus(next) };
    all[existingIdx] = normalized;
    saveAll(all);
    return normalized;
  }

  const link: Link = {
    id: makeId("link"),
    seekerId,
    retainerId,
    requestedBySeeker: args.by === "SEEKER",
    requestedByRetainer: args.by === "RETAINER",
    videoConfirmedBySeeker: false,
    videoConfirmedByRetainer: false,
    approvedBySeeker: false,
    approvedByRetainer: false,
    workingTogetherBySeeker: false,
    workingTogetherByRetainer: false,
    meetingProposals: [],
    meetingAcceptedProposalId: null,
    meetingAcceptedAt: null,
    status: "PENDING",
    createdAt: ts,
    updatedAt: ts,
  };

  all.push(link);
  saveAll(all);
  return link;
}

export function setLinkVideoConfirmed(args: {
  seekerId: string;
  retainerId: string;
  by: "SEEKER" | "RETAINER";
  value: boolean;
}): Link | null {
  if (args.by === "SEEKER") {
    assertSeekerCanLink(args.seekerId);
  }
  const all = loadAll();
  const idx = all.findIndex((l) => l.seekerId === args.seekerId && l.retainerId === args.retainerId);
  if (idx < 0) return null;

  const ts = nowIso();
  const current = all[idx];
  const next: Link = {
    ...current,
    videoConfirmedBySeeker:
      args.by === "SEEKER" ? Boolean(args.value) : current.videoConfirmedBySeeker,
    videoConfirmedByRetainer:
      args.by === "RETAINER" ? Boolean(args.value) : current.videoConfirmedByRetainer,
    updatedAt: ts,
  };

  const normalized: Link = { ...next, status: computeStatus(next) };
  all[idx] = normalized;
  saveAll(all);
  return normalized;
}

export function setLinkApproved(args: {
  seekerId: string;
  retainerId: string;
  by: "SEEKER" | "RETAINER";
  value: boolean;
}): Link | null {
  if (args.by === "SEEKER") {
    assertSeekerCanLink(args.seekerId);
  }
  const all = loadAll();
  const idx = all.findIndex((l) => l.seekerId === args.seekerId && l.retainerId === args.retainerId);
  if (idx < 0) return null;

  const ts = nowIso();
  const current = all[idx];
  const next: Link = {
    ...current,
    approvedBySeeker:
      args.by === "SEEKER" ? Boolean(args.value) : current.approvedBySeeker,
    approvedByRetainer:
      args.by === "RETAINER" ? Boolean(args.value) : current.approvedByRetainer,
    updatedAt: ts,
  };

  const normalized: Link = { ...next, status: computeStatus(next) };
  all[idx] = normalized;
  saveAll(all);
  return normalized;
}

export function setLinkStatus(args: {
  seekerId: string;
  retainerId: string;
  status: LinkStatus;
}): Link | null {
  const all = loadAll();
  const idx = all.findIndex((l) => l.seekerId === args.seekerId && l.retainerId === args.retainerId);
  if (idx < 0) return null;

  const ts = nowIso();
  const current = all[idx];
  const next: Link = {
    ...current,
    status: args.status,
    updatedAt: ts,
  };
  all[idx] = next;
  saveAll(all);
  return next;
}

export function resetLink(seekerId: string, retainerId: string): Link | null {
  if (!seekerId || !retainerId) return null;
  const all = loadAll();
  const idx = all.findIndex(
    (l) => l.seekerId === seekerId && l.retainerId === retainerId
  );
  if (idx < 0) return null;

  const ts = nowIso();
  const next: Link = {
    ...all[idx],
    requestedBySeeker: false,
    requestedByRetainer: false,
    videoConfirmedBySeeker: false,
    videoConfirmedByRetainer: false,
    approvedBySeeker: false,
    approvedByRetainer: false,
    workingTogetherBySeeker: false,
    workingTogetherByRetainer: false,
    meetingProposals: [],
    meetingAcceptedProposalId: null,
    meetingAcceptedAt: null,
    status: "PENDING",
    updatedAt: ts,
  };

  all[idx] = next;
  saveAll(all);
  return next;
}

export function isWorkingTogether(link: Link | null): boolean {
  if (!link) return false;
  if (link.status !== "ACTIVE") return false;
  return Boolean(link.workingTogetherBySeeker && link.workingTogetherByRetainer);
}

export function addLinkMeetingProposal(args: {
  seekerId: string;
  retainerId: string;
  by: "SEEKER" | "RETAINER";
  startAt: string; // ISO
  durationMinutes: number;
  note?: string;
}): Link {
  assertSeekerCanLink(args.seekerId);
  if (!args.seekerId || !args.retainerId) {
    throw new Error("seekerId and retainerId are required");
  }

  // Ensure the link exists (and mark requester) before adding proposals
  requestLink({ seekerId: args.seekerId, retainerId: args.retainerId, by: args.by });

  const all = loadAll();
  const idx = all.findIndex(
    (l) => l.seekerId === args.seekerId && l.retainerId === args.retainerId
  );
  if (idx < 0) {
    throw new Error("Failed to create link");
  }

  const ts = nowIso();
  const current = all[idx];
  const proposal: LinkMeetingProposal = {
    id: makeId("meet"),
    startAt: args.startAt,
    durationMinutes: args.durationMinutes,
    by: args.by,
    note: args.note?.trim() ? args.note.trim() : undefined,
    createdAt: ts,
  };

  const next: Link = {
    ...current,
    meetingProposals: [...(current.meetingProposals || []), proposal],
    updatedAt: ts,
  };

  const normalized: Link = { ...next, status: computeStatus(next) };
  all[idx] = normalized;
  saveAll(all);
  return normalized;
}

export function acceptLinkMeetingProposal(args: {
  seekerId: string;
  retainerId: string;
  proposalId: string;
}): Link | null {
  assertSeekerCanLink(args.seekerId);
  const all = loadAll();
  const idx = all.findIndex(
    (l) => l.seekerId === args.seekerId && l.retainerId === args.retainerId
  );
  if (idx < 0) return null;

  const current = all[idx];
  const proposals = current.meetingProposals || [];
  if (!proposals.some((p) => p.id === args.proposalId)) return null;

  const ts = nowIso();
  const next: Link = {
    ...current,
    meetingAcceptedProposalId: args.proposalId,
    meetingAcceptedAt: ts,
    updatedAt: ts,
  };

  const normalized: Link = { ...next, status: computeStatus(next) };
  all[idx] = normalized;
  saveAll(all);
  return normalized;
}

export function clearLinkMeetingSchedule(args: {
  seekerId: string;
  retainerId: string;
}): Link | null {
  assertSeekerCanLink(args.seekerId);
  const all = loadAll();
  const idx = all.findIndex(
    (l) => l.seekerId === args.seekerId && l.retainerId === args.retainerId
  );
  if (idx < 0) return null;

  const ts = nowIso();
  const current = all[idx];
  const next: Link = {
    ...current,
    meetingAcceptedProposalId: null,
    meetingAcceptedAt: null,
    updatedAt: ts,
  };

  all[idx] = next;
  saveAll(all);
  return next;
}

export function setWorkingTogether(args: {
  seekerId: string;
  retainerId: string;
  by: "SEEKER" | "RETAINER";
  value: boolean;
}): Link | null {
  if (args.by === "SEEKER") {
    assertSeekerCanLink(args.seekerId);
  }
  const all = loadAll();
  const idx = all.findIndex(
    (l) => l.seekerId === args.seekerId && l.retainerId === args.retainerId
  );
  if (idx < 0) return null;

  const ts = nowIso();
  const current = all[idx];
  const next: Link = {
    ...current,
    workingTogetherBySeeker:
      args.by === "SEEKER"
        ? Boolean(args.value)
        : Boolean(current.workingTogetherBySeeker),
    workingTogetherByRetainer:
      args.by === "RETAINER"
        ? Boolean(args.value)
        : Boolean(current.workingTogetherByRetainer),
    updatedAt: ts,
  };

  all[idx] = next;
  saveAll(all);
  return next;
}

export function disableLinksForSeeker(seekerId: string): Link[] {
  if (!seekerId) return [];
  const all = loadAll();
  const ts = nowIso();
  let changed = false;
  const next: Link[] = all.map((l): Link => {
    if (l.seekerId !== seekerId) return l;
    if (l.status === "DISABLED") return l;
    changed = true;
    return { ...l, status: "DISABLED" as LinkStatus, updatedAt: ts };
  });
  if (changed) saveAll(next);
  return next.filter((l) => l.seekerId === seekerId && l.status === "DISABLED");
}

export function disableLinksForRetainer(retainerId: string): Link[] {
  if (!retainerId) return [];
  const all = loadAll();
  const ts = nowIso();
  let changed = false;
  const next: Link[] = all.map((l): Link => {
    if (l.retainerId !== retainerId) return l;
    if (l.status === "DISABLED") return l;
    changed = true;
    return { ...l, status: "DISABLED" as LinkStatus, updatedAt: ts };
  });
  if (changed) saveAll(next);
  return next.filter((l) => l.retainerId === retainerId && l.status === "DISABLED");
}
