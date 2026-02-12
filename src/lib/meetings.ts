import { readStoreData, writeStore } from "./storage";

export type InterviewMeetingStatus = "DRAFT" | "PROPOSED" | "FINALIZED" | "CANCELED";
export type InterviewMeetingResponseStatus = "INVITED" | "CONFIRMED" | "DECLINED";
export type InterviewMeetingOutcome = "MET" | "NO_SHOW";

export type InterviewMeetingProposal = {
  id: string;
  startAt: string;
  durationMinutes: number;
  createdAt: string;
};

export type InterviewMeetingAttendee = {
  id: string;
  seekerId: string;
  seekerName?: string;
  seekerEmail?: string;
  responseStatus: InterviewMeetingResponseStatus;
  selectedProposalId?: string | null;
  retainerOutcome?: InterviewMeetingOutcome | null;
  seekerOutcome?: InterviewMeetingOutcome | null;
  rescheduleRequested?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InterviewMeeting = {
  id: string;
  retainerId: string;
  title: string;
  note?: string;
  timezone: string;
  durationMinutes: number;
  status: InterviewMeetingStatus;
  proposals: InterviewMeetingProposal[];
  attendees: InterviewMeetingAttendee[];
  finalizedProposalId?: string | null;
  finalizedAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  googleEventId?: string | null;
  meetLink?: string | null;
  createdAt: string;
  updatedAt: string;
};

const KEY = "snapdriver_interview_meetings_v1";
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

function normalizeProposal(raw: any): InterviewMeetingProposal | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.startAt) return null;
  const durationRaw =
    typeof raw.durationMinutes === "number"
      ? raw.durationMinutes
      : Number(raw.durationMinutes);
  const durationMinutes = Number.isFinite(durationRaw)
    ? Math.max(5, Math.min(180, Math.round(durationRaw)))
    : 20;
  return {
    id: String(raw.id || makeId("meet_slot")),
    startAt: String(raw.startAt),
    durationMinutes,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
  };
}

function normalizeAttendee(raw: any): InterviewMeetingAttendee | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.seekerId) return null;
  const responseStatus: InterviewMeetingResponseStatus =
    raw.responseStatus === "CONFIRMED" || raw.responseStatus === "DECLINED"
      ? raw.responseStatus
      : "INVITED";
  const retainerOutcome: InterviewMeetingOutcome | null =
    raw.retainerOutcome === "MET" || raw.retainerOutcome === "NO_SHOW"
      ? raw.retainerOutcome
      : null;
  const seekerOutcome: InterviewMeetingOutcome | null =
    raw.seekerOutcome === "MET" || raw.seekerOutcome === "NO_SHOW"
      ? raw.seekerOutcome
      : null;

  return {
    id: String(raw.id || makeId("meet_att")),
    seekerId: String(raw.seekerId),
    seekerName: typeof raw.seekerName === "string" ? raw.seekerName : undefined,
    seekerEmail: typeof raw.seekerEmail === "string" ? raw.seekerEmail : undefined,
    responseStatus,
    selectedProposalId:
      typeof raw.selectedProposalId === "string" ? raw.selectedProposalId : null,
    retainerOutcome,
    seekerOutcome,
    rescheduleRequested: Boolean(raw.rescheduleRequested),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function normalizeMeeting(raw: any): InterviewMeeting | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.retainerId) return null;
  const status: InterviewMeetingStatus =
    raw.status === "FINALIZED" || raw.status === "CANCELED" || raw.status === "PROPOSED"
      ? raw.status
      : "DRAFT";
  const proposals = Array.isArray(raw.proposals)
    ? (raw.proposals as any[])
        .map(normalizeProposal)
        .filter((p): p is InterviewMeetingProposal => p !== null)
    : [];
  const attendees = Array.isArray(raw.attendees)
    ? (raw.attendees as any[])
        .map(normalizeAttendee)
        .filter((a): a is InterviewMeetingAttendee => a !== null)
    : [];
  return {
    id: String(raw.id || makeId("meet")),
    retainerId: String(raw.retainerId),
    title: typeof raw.title === "string" ? raw.title : "Interview",
    note: typeof raw.note === "string" ? raw.note : undefined,
    timezone: typeof raw.timezone === "string" ? raw.timezone : "America/New_York",
    durationMinutes:
      typeof raw.durationMinutes === "number" && Number.isFinite(raw.durationMinutes)
        ? Math.max(10, Math.min(120, Math.round(raw.durationMinutes)))
        : 30,
    status,
    proposals,
    attendees,
    finalizedProposalId:
      typeof raw.finalizedProposalId === "string" ? raw.finalizedProposalId : null,
    finalizedAt: typeof raw.finalizedAt === "string" ? raw.finalizedAt : null,
    startsAt: typeof raw.startsAt === "string" ? raw.startsAt : null,
    endsAt: typeof raw.endsAt === "string" ? raw.endsAt : null,
    googleEventId:
      typeof raw.googleEventId === "string" ? raw.googleEventId : null,
    meetLink: typeof raw.meetLink === "string" ? raw.meetLink : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
  };
}

function loadAll(): InterviewMeeting[] {
  const parsed = readStoreData<unknown>(KEY);
  if (!Array.isArray(parsed)) return [];
  return (parsed as any[])
    .map(normalizeMeeting)
    .filter((m): m is InterviewMeeting => m !== null);
}

function saveAll(list: InterviewMeeting[]) {
  writeStore(KEY, SCHEMA_VERSION, list);
}

export function getAllMeetings(): InterviewMeeting[] {
  return loadAll().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getMeetingsForRetainer(retainerId: string): InterviewMeeting[] {
  if (!retainerId) return [];
  return getAllMeetings().filter((m) => m.retainerId === retainerId);
}

export function getMeetingsForSeeker(seekerId: string): InterviewMeeting[] {
  if (!seekerId) return [];
  return getAllMeetings().filter((m) =>
    (m.attendees || []).some((a) => a.seekerId === seekerId)
  );
}

function upsertMeeting(next: InterviewMeeting): InterviewMeeting {
  const all = loadAll();
  const idx = all.findIndex((m) => m.id === next.id);
  if (idx >= 0) {
    all[idx] = next;
  } else {
    all.push(next);
  }
  saveAll(all);
  return next;
}

export function createInterviewMeeting(input: {
  retainerId: string;
  title: string;
  note?: string;
  timezone: string;
  durationMinutes: number;
  proposals: Array<{ startAt: string; durationMinutes?: number }>;
  attendees: Array<{ seekerId: string; seekerName?: string; seekerEmail?: string }>;
}): InterviewMeeting {
  const retainerId = String(input.retainerId || "").trim();
  if (!retainerId) throw new Error("retainerId is required");
  if (!input.attendees || input.attendees.length === 0) {
    throw new Error("Select at least one seeker.");
  }
  const proposalsRaw = input.proposals || [];
  if (proposalsRaw.length === 0) throw new Error("Add at least one time slot.");

  const ts = nowIso();
  const proposals: InterviewMeetingProposal[] = proposalsRaw.map((p) => ({
    id: makeId("meet_slot"),
    startAt: p.startAt,
    durationMinutes: p.durationMinutes ?? input.durationMinutes ?? 30,
    createdAt: ts,
  }));
  const attendees: InterviewMeetingAttendee[] = input.attendees.map((a) => ({
    id: makeId("meet_att"),
    seekerId: String(a.seekerId),
    seekerName: a.seekerName,
    seekerEmail: a.seekerEmail,
    responseStatus: "INVITED",
    selectedProposalId: null,
    retainerOutcome: null,
    seekerOutcome: null,
    rescheduleRequested: false,
    createdAt: ts,
    updatedAt: ts,
  }));

  const meeting: InterviewMeeting = {
    id: makeId("meet"),
    retainerId,
    title: String(input.title || "Interview"),
    note: input.note?.trim() ? input.note.trim() : undefined,
    timezone: input.timezone || "America/New_York",
    durationMinutes: input.durationMinutes || 30,
    status: "PROPOSED",
    proposals,
    attendees,
    finalizedProposalId: null,
    finalizedAt: null,
    startsAt: null,
    endsAt: null,
    googleEventId: null,
    meetLink: null,
    createdAt: ts,
    updatedAt: ts,
  };

  return upsertMeeting(meeting);
}

export function addMeetingProposal(args: {
  meetingId: string;
  startAt: string;
  durationMinutes: number;
}): InterviewMeeting | null {
  const all = loadAll();
  const idx = all.findIndex((m) => m.id === args.meetingId);
  if (idx < 0) return null;
  const current = all[idx];
  if (current.status === "CANCELED") return current;
  const ts = nowIso();
  const proposal: InterviewMeetingProposal = {
    id: makeId("meet_slot"),
    startAt: args.startAt,
    durationMinutes: args.durationMinutes,
    createdAt: ts,
  };
  const next: InterviewMeeting = {
    ...current,
    proposals: [...(current.proposals || []), proposal],
    status: current.status === "FINALIZED" ? "PROPOSED" : current.status,
    updatedAt: ts,
  };
  all[idx] = next;
  saveAll(all);
  return next;
}

export function setAttendeeResponse(args: {
  meetingId: string;
  seekerId: string;
  responseStatus: InterviewMeetingResponseStatus;
  selectedProposalId?: string | null;
  rescheduleRequested?: boolean;
}): InterviewMeeting | null {
  const all = loadAll();
  const idx = all.findIndex((m) => m.id === args.meetingId);
  if (idx < 0) return null;
  const current = all[idx];
  const ts = nowIso();
  const attendees = (current.attendees || []).map((a) => {
    if (a.seekerId !== args.seekerId) return a;
    return {
      ...a,
      responseStatus: args.responseStatus,
      selectedProposalId:
        typeof args.selectedProposalId === "string" ? args.selectedProposalId : null,
      rescheduleRequested: Boolean(args.rescheduleRequested),
      updatedAt: ts,
    };
  });
  const next: InterviewMeeting = { ...current, attendees, updatedAt: ts };
  all[idx] = next;
  saveAll(all);
  return next;
}

export function finalizeMeeting(args: {
  meetingId: string;
  proposalId: string;
}): InterviewMeeting | null {
  const all = loadAll();
  const idx = all.findIndex((m) => m.id === args.meetingId);
  if (idx < 0) return null;
  const current = all[idx];
  const proposal = (current.proposals || []).find((p) => p.id === args.proposalId);
  if (!proposal) return null;
  const ts = nowIso();
  const startAt = proposal.startAt;
  const startDt = new Date(startAt);
  const endAt = new Date(startDt.getTime() + proposal.durationMinutes * 60000).toISOString();
  const next: InterviewMeeting = {
    ...current,
    status: "FINALIZED",
    finalizedProposalId: proposal.id,
    finalizedAt: ts,
    startsAt: startAt,
    endsAt: endAt,
    updatedAt: ts,
  };
  all[idx] = next;
  saveAll(all);
  return next;
}

export function requestMeetingReschedule(args: {
  meetingId: string;
  by: "RETAINER" | "SEEKER";
  seekerId?: string;
}): InterviewMeeting | null {
  const all = loadAll();
  const idx = all.findIndex((m) => m.id === args.meetingId);
  if (idx < 0) return null;
  const current = all[idx];
  const ts = nowIso();
  const attendees = (current.attendees || []).map((a) => {
    if (args.by === "SEEKER" && args.seekerId && a.seekerId !== args.seekerId) {
      return a;
    }
    if (args.by === "SEEKER") {
      return { ...a, rescheduleRequested: true, updatedAt: ts };
    }
    return a;
  });
  const next: InterviewMeeting = {
    ...current,
    status: "PROPOSED",
    finalizedProposalId: null,
    finalizedAt: null,
    startsAt: null,
    endsAt: null,
    updatedAt: ts,
    attendees,
  };
  all[idx] = next;
  saveAll(all);
  return next;
}

export function cancelMeeting(args: { meetingId: string }): InterviewMeeting | null {
  const all = loadAll();
  const idx = all.findIndex((m) => m.id === args.meetingId);
  if (idx < 0) return null;
  const current = all[idx];
  const ts = nowIso();
  const next: InterviewMeeting = { ...current, status: "CANCELED", updatedAt: ts };
  all[idx] = next;
  saveAll(all);
  return next;
}

export function markMeetingOutcome(args: {
  meetingId: string;
  seekerId: string;
  by: "RETAINER" | "SEEKER";
  outcome: InterviewMeetingOutcome;
}): InterviewMeeting | null {
  const all = loadAll();
  const idx = all.findIndex((m) => m.id === args.meetingId);
  if (idx < 0) return null;
  const current = all[idx];
  const ts = nowIso();
  const attendees = (current.attendees || []).map((a) => {
    if (a.seekerId !== args.seekerId) return a;
    if (args.by === "RETAINER") {
      return { ...a, retainerOutcome: args.outcome, updatedAt: ts };
    }
    return { ...a, seekerOutcome: args.outcome, updatedAt: ts };
  });
  const next: InterviewMeeting = { ...current, attendees, updatedAt: ts };
  all[idx] = next;
  saveAll(all);
  return next;
}
