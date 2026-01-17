// src/lib/subcontractorMessages.ts

import { readStoreData, writeStore } from "./storage";

export type SubcontractorMessage = {
  id: string;
  seekerId: string;
  subcontractorId: string;
  sender: "MASTER" | "SUBCONTRACTOR";
  body: string;
  createdAt: string;
};

const SUB_MSG_KEY = "snapdriver_subcontractor_messages_v1";
const SUB_MSG_SCHEMA_VERSION = 1;

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

function loadAll(): SubcontractorMessage[] {
  if (typeof window === "undefined") return [];
  const parsed = readStoreData<unknown>(SUB_MSG_KEY);
  return Array.isArray(parsed) ? (parsed as SubcontractorMessage[]) : [];
}

function saveAll(list: SubcontractorMessage[]) {
  if (typeof window === "undefined") return;
  writeStore(SUB_MSG_KEY, SUB_MSG_SCHEMA_VERSION, list);
}

export function getSubcontractorMessages(
  seekerId: string,
  subcontractorId: string
): SubcontractorMessage[] {
  if (!seekerId || !subcontractorId) return [];
  return loadAll()
    .filter(
      (m) => m.seekerId === seekerId && m.subcontractorId === subcontractorId
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function addSubcontractorMessage(input: {
  seekerId: string;
  subcontractorId: string;
  sender: "MASTER" | "SUBCONTRACTOR";
  body: string;
}): SubcontractorMessage {
  if (!input.seekerId || !input.subcontractorId) {
    throw new Error("seekerId and subcontractorId are required");
  }
  const body = (input.body || "").trim();
  if (!body) throw new Error("body is required");

  const msg: SubcontractorMessage = {
    id: makeId("submsg"),
    seekerId: input.seekerId,
    subcontractorId: input.subcontractorId,
    sender: input.sender,
    body,
    createdAt: nowIso(),
  };

  const all = loadAll();
  all.push(msg);
  saveAll(all);
  return msg;
}
