// src/lib/retainerStaffMessages.ts

import { readStoreData, writeStore } from "./storage";

export type RetainerStaffMessage = {
  id: string;
  retainerId: string;
  userId: string;
  sender: "OWNER" | "STAFF";
  body: string;
  createdAt: string;
};

const STAFF_MSG_KEY = "snapdriver_retainer_staff_messages_v1";
const STAFF_MSG_SCHEMA_VERSION = 1;

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

function loadAll(): RetainerStaffMessage[] {
  if (typeof window === "undefined") return [];
  const parsed = readStoreData<unknown>(STAFF_MSG_KEY);
  return Array.isArray(parsed) ? (parsed as RetainerStaffMessage[]) : [];
}

function saveAll(list: RetainerStaffMessage[]) {
  if (typeof window === "undefined") return;
  writeStore(STAFF_MSG_KEY, STAFF_MSG_SCHEMA_VERSION, list);
}

export function getRetainerStaffMessages(
  retainerId: string,
  userId: string
): RetainerStaffMessage[] {
  if (!retainerId || !userId) return [];
  return loadAll()
    .filter((m) => m.retainerId === retainerId && m.userId === userId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function addRetainerStaffMessage(input: {
  retainerId: string;
  userId: string;
  sender: "OWNER" | "STAFF";
  body: string;
}): RetainerStaffMessage {
  if (!input.retainerId || !input.userId) {
    throw new Error("retainerId and userId are required");
  }
  const body = (input.body || "").trim();
  if (!body) throw new Error("body is required");

  const msg: RetainerStaffMessage = {
    id: makeId("staffmsg"),
    retainerId: input.retainerId,
    userId: input.userId,
    sender: input.sender,
    body,
    createdAt: nowIso(),
  };

  const all = loadAll();
  all.push(msg);
  saveAll(all);
  return msg;
}
