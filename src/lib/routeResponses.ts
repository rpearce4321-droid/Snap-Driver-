// src/lib/routeResponses.ts

import { readStoreData, writeStore } from "./storage";

export type RouteResponseType =
  | "INTERESTED"
  | "REQUEST_INFO"
  | "NOT_INTERESTED"
  | "DIRECT_MESSAGE";

export type RouteResponse = {
  id: string;
  routeId: string;
  retainerId: string;
  seekerId: string;
  type: RouteResponseType;
  reasonCode?: string;
  note?: string;
  createdAt: string;
};

export const NOT_INTERESTED_REASONS: Array<{ code: string; label: string }> = [
  { code: "schedule", label: "Schedule does not fit" },
  { code: "pay", label: "Pay is not a fit" },
  { code: "distance", label: "Too far from my area" },
  { code: "equipment", label: "Missing required equipment" },
  { code: "other", label: "Other" },
];

const KEY = "snapdriver_route_responses_v1";
const SEEN_KEY = "snapdriver_route_response_seen_v1";
const SCHEMA_VERSION = 1;
export const ROUTE_RESPONSES_EVENT = "snapdriver:route-responses";

function nowIso() {
  return new Date().toISOString();
}


function emitChange() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ROUTE_RESPONSES_EVENT));
  } catch {
    // ignore
  }
}

function makeId(prefix: string) {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rnd}`;
}

function loadAll(): RouteResponse[] {
  if (typeof window === "undefined") return [];
  const parsed = readStoreData<RouteResponse[]>(KEY);
  return Array.isArray(parsed) ? parsed : [];
}

function saveAll(list: RouteResponse[]) {
  if (typeof window === "undefined") return;
  writeStore(KEY, SCHEMA_VERSION, list);
}

function loadSeen(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const parsed = readStoreData<Record<string, string>>(SEEN_KEY);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function saveSeen(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  writeStore(SEEN_KEY, SCHEMA_VERSION, map);
}

function seenKey(retainerId: string, routeId: string) {
  return `${retainerId}:${routeId}`;
}

export function recordRouteResponse(args: {
  routeId: string;
  retainerId: string;
  seekerId: string;
  type: RouteResponseType;
  reasonCode?: string;
  note?: string;
}): RouteResponse {
  const routeId = String(args.routeId || "").trim();
  const retainerId = String(args.retainerId || "").trim();
  const seekerId = String(args.seekerId || "").trim();
  if (!routeId || !retainerId || !seekerId) {
    throw new Error("routeId, retainerId, seekerId are required");
  }

  const all = loadAll();
  const next = all.filter(
    (r) => !(r.routeId === routeId && r.seekerId === seekerId)
  );

  const createdAt = nowIso();
  const response: RouteResponse = {
    id: makeId("route_resp"),
    routeId,
    retainerId,
    seekerId,
    type: args.type,
    reasonCode: args.reasonCode || undefined,
    note: args.note || undefined,
    createdAt,
  };

  next.unshift(response);
  saveAll(next);
  emitChange();
  return response;
}

export function getRouteResponsesForRoute(routeId: string): RouteResponse[] {
  const rid = String(routeId || "").trim();
  if (!rid) return [];
  return loadAll()
    .filter((r) => r.routeId === rid)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getRouteResponsesForRetainer(retainerId: string): RouteResponse[] {
  const rid = String(retainerId || "").trim();
  if (!rid) return [];
  return loadAll()
    .filter((r) => r.retainerId === rid)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getRouteResponsesForSeeker(seekerId: string): RouteResponse[] {
  const sid = String(seekerId || "").trim();
  if (!sid) return [];
  return loadAll()
    .filter((r) => r.seekerId === sid)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getRouteResponseCounts(routeId: string): Record<RouteResponseType, number> {
  const counts: Record<RouteResponseType, number> = {
    INTERESTED: 0,
    REQUEST_INFO: 0,
    NOT_INTERESTED: 0,
    DIRECT_MESSAGE: 0,
  };
  for (const r of getRouteResponsesForRoute(routeId)) {
    counts[r.type] += 1;
  }
  return counts;
}

export function getRouteResponsesGrouped(routeId: string): Record<RouteResponseType, RouteResponse[]> {
  const grouped: Record<RouteResponseType, RouteResponse[]> = {
    INTERESTED: [],
    REQUEST_INFO: [],
    NOT_INTERESTED: [],
    DIRECT_MESSAGE: [],
  };
  for (const r of getRouteResponsesForRoute(routeId)) {
    grouped[r.type].push(r);
  }
  return grouped;
}

export function getRouteResponseForSeeker(routeId: string, seekerId: string): RouteResponse | null {
  const rid = String(routeId || "").trim();
  const sid = String(seekerId || "").trim();
  if (!rid || !sid) return null;
  return loadAll().find((r) => r.routeId === rid && r.seekerId === sid) || null;
}

export function markRouteResponsesSeen(retainerId: string, routeId: string) {
  const rid = String(retainerId || "").trim();
  const route = String(routeId || "").trim();
  if (!rid || !route) return;
  const map = loadSeen();
  map[seenKey(rid, route)] = nowIso();
  saveSeen(map);
  emitChange();
}

export function getUnreadRouteResponseCount(retainerId: string, routeId: string): number {
  const rid = String(retainerId || "").trim();
  const route = String(routeId || "").trim();
  if (!rid || !route) return 0;
  const map = loadSeen();
  const seenAt = map[seenKey(rid, route)];
  const seenTs = seenAt ? Date.parse(seenAt) : 0;
  const responses = getRouteResponsesForRoute(route);
  return responses.filter((r) => Date.parse(r.createdAt) > seenTs).length;
}
